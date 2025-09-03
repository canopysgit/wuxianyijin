-- Employee baseline table, helper functions, and refresh routines
-- This script creates:
-- 1) normalize_month_yyyymm(text): normalize strings like "2022年6月", "2022/06", "202206" to YYYYMM
-- 2) compute_first_insurance_month(date): per hire_date with 15th rule and 2022+ restriction
-- 3) employee_baseline table
-- 4) refresh routines (all employees / one employee)
-- 5) warnings view when first-month bases are missing

-- 1) Normalize various month formats to YYYYMM (text)
create or replace function normalize_month_yyyymm(in_text text)
returns text
language plpgsql
immutable
as $$
declare
  t text;
  y text;
  m text;
  res text;
  cnm text;
  cnm_int int;
  y_cn text;
  y_cn_norm text;
begin
  if in_text is null then
    return null;
  end if;

  t := btrim(in_text);

  -- Normalize full-width digits and separators to ASCII to improve matching robustness
  -- Full-width digits: ０１２３４５６７８９ → 0123456789
  -- Common separators: ／－—（全角/半角斜杠与连字符）、全角空格 → 半角
  t := translate(
         t,
         '０１２３４５６７８９／－—　',
         '0123456789/-- '
       );

  -- Already YYYYMM
  if t ~ '^[0-9]{6}$' then
    if substring(t,5,2)::int between 1 and 12 then
      return t;
    else
      return null;
    end if;
  end if;

  -- Extract year and month from common patterns, including Chinese 'YYYY年M月'
  -- Use Postgres-compatible regex classes (no \d/\D): [0-9] and [^0-9]
  -- Capture a 4-digit year anywhere, then the following 1-2 digit month
  y := substring(t from '([0-9]{4})');
  m := substring(t from '[0-9]{4}[^0-9]*?([0-9]{1,2})');

  if y is not null and m is not null then
    if m ~ '^[0-9]{1,2}$' and m::int between 1 and 12 then
      res := y || lpad(m, 2, '0');
      return res;
    end if;
  end if;

  -- Fallback: Chinese numeral months like '2022年十月', '2022年十一月', '2022年十二月'
  y := substring(t from '([0-9]{4})');
  cnm := substring(t from '[0-9]{4}[^0-9]*?([一二三四五六七八九十〇零]{1,3})');
  if y is not null and cnm is not null then
    -- Map Chinese numerals to month int
    cnm := replace(cnm, '〇', '零');
    -- Handle 十, 十一, 十二 patterns
    if cnm = '十' then
      cnm_int := 10;
    elsif cnm = '十一' then
      cnm_int := 11;
    elsif cnm = '十二' then
      cnm_int := 12;
    else
      -- Single numerals 一..九
      cnm_int := case cnm
        when '一' then 1
        when '二' then 2
        when '三' then 3
        when '四' then 4
        when '五' then 5
        when '六' then 6
        when '七' then 7
        when '八' then 8
        when '九' then 9
        when '零' then 0
        else null end;
      -- Also support 组合 "十X" like 十三 -> 13 (理论上不会出现在月份，但以防数据异常)
      if cnm_int is null and position('十' in cnm) = 1 and length(cnm) = 2 then
        -- 十三 => 10 + 3
        cnm_int := 10 + case substring(cnm from 2 for 1)
          when '一' then 1
          when '二' then 2
          when '三' then 3
          when '四' then 4
          when '五' then 5
          when '六' then 6
          when '七' then 7
          when '八' then 8
          when '九' then 9
          else null end;
      end if;
    end if;
    if cnm_int between 1 and 12 then
      return y || lpad(cnm_int::text, 2, '0');
    end if;
  end if;

  -- Fallback 2: Chinese numeral year like '二〇二二年十月' or '二零二二年十月'
  y_cn := substring(t from '([〇零一二三四五六七八九]{4})');
  cnm := substring(t from '[〇零一二三四五六七八九]{4}[^0-9一二三四五六七八九十〇零]*?([一二三四五六七八九十〇零]{1,3})');
  if y_cn is not null and cnm is not null then
    y_cn_norm := replace(y_cn, '〇', '零');
    y := translate(y_cn_norm, '零一二三四五六七八九', '0123456789');
    -- Reuse the month Chinese parsing above
    cnm := replace(cnm, '〇', '零');
    if cnm = '十' then
      cnm_int := 10;
    elsif cnm = '十一' then
      cnm_int := 11;
    elsif cnm = '十二' then
      cnm_int := 12;
    else
      cnm_int := case cnm
        when '一' then 1
        when '二' then 2
        when '三' then 3
        when '四' then 4
        when '五' then 5
        when '六' then 6
        when '七' then 7
        when '八' then 8
        when '九' then 9
        when '零' then 0
        else null end;
      if cnm_int is null and position('十' in cnm) = 1 and length(cnm) = 2 then
        cnm_int := 10 + case substring(cnm from 2 for 1)
          when '一' then 1
          when '二' then 2
          when '三' then 3
          when '四' then 4
          when '五' then 5
          when '六' then 6
          when '七' then 7
          when '八' then 8
          when '九' then 9
          else null end;
      end if;
    end if;
    if y ~ '^[0-9]{4}$' and cnm_int between 1 and 12 then
      return y || lpad(cnm_int::text, 2, '0');
    end if;
  end if;

  return null; -- Unparseable
end;
$$;

-- 2) Compute first insurance month from hire_date
-- Rule: if hire_date < 2022-01-01 => null; else day<=15 => same month; else next month.
create or replace function compute_first_insurance_month(hire_date date)
returns text
language sql
immutable
as $$
  select case
    when hire_date is null then null
    when hire_date < date '2022-01-01' then null
    when extract(day from hire_date) <= 15 then to_char(hire_date, 'YYYYMM')
    else to_char((date_trunc('month', hire_date) + interval '1 month')::date, 'YYYYMM')
  end;
$$;

-- 3) Baseline table
create table if not exists employee_baseline (
  employee_id text primary key,
  hire_date date not null,

  -- Months as text in YYYYMM to avoid timezone/date-shift issues
  first_payroll_month text,
  first_insurance_month text,

  first_month_base_wide numeric(12,2),   -- from gross_salary
  first_month_base_narrow numeric(12,2), -- from basic_salary

  avg_wage_wide_2022 numeric(12,2),
  avg_wage_narrow_2022 numeric(12,2),
  avg_wage_wide_2023 numeric(12,2),
  avg_wage_narrow_2023 numeric(12,2),

  computed_at timestamptz default now(),

  -- Checks
  constraint chk_first_payroll_month_yyyymm
    check (
      first_payroll_month is null or (
        first_payroll_month ~ '^[0-9]{6}$' and
        substring(first_payroll_month,5,2)::int between 1 and 12
      )
    ),
  constraint chk_first_insurance_month_yyyymm
    check (
      first_insurance_month is null or (
        first_insurance_month ~ '^[0-9]{6}$' and
        substring(first_insurance_month,5,2)::int between 1 and 12
      )
    ),
  constraint chk_nonneg_wide_first_base check (first_month_base_wide is null or first_month_base_wide >= 0),
  constraint chk_nonneg_narrow_first_base check (first_month_base_narrow is null or first_month_base_narrow >= 0),
  constraint chk_nonneg_avg_wide_2022 check (avg_wage_wide_2022 is null or avg_wage_wide_2022 >= 0),
  constraint chk_nonneg_avg_narrow_2022 check (avg_wage_narrow_2022 is null or avg_wage_narrow_2022 >= 0),
  constraint chk_nonneg_avg_wide_2023 check (avg_wage_wide_2023 is null or avg_wage_wide_2023 >= 0),
  constraint chk_nonneg_avg_narrow_2023 check (avg_wage_narrow_2023 is null or avg_wage_narrow_2023 >= 0)
);

create index if not exists idx_employee_baseline_first_insurance_month
  on employee_baseline(first_insurance_month);

-- 4) Refresh helpers
-- 4.1) Refresh a single employee
create or replace function refresh_employee_baseline_for_employee(p_employee_id text)
returns void
language plpgsql
as $$
begin
  with permonth as (
    select
      sr.employee_id,
      sr.salary_month_std as ym,
      sum(sr.gross_salary)::numeric as gross_sum,
      sum(sr.basic_salary)::numeric as basic_sum
    from salary_records sr
    where sr.employee_id = p_employee_id
      and sr.salary_month_std is not null
    group by sr.employee_id, sr.salary_month_std
  ),
  base as (
    select
      sr.employee_id,
      min(sr.hire_date)::date as hire_date,
      (select min(ym) from permonth where ym is not null) as first_payroll_month,
      compute_first_insurance_month(min(sr.hire_date)::date) as first_insurance_month
    from salary_records sr
    where sr.employee_id = p_employee_id
    group by sr.employee_id
  ),
  first_bases as (
    select
      b.employee_id,
      pm.gross_sum as first_wide,
      pm.basic_sum as first_narrow
    from base b
    left join permonth pm
      on pm.employee_id = b.employee_id and pm.ym = b.first_insurance_month
  ),
  avg2022 as (
    select
      employee_id,
      round(avg(gross_sum), 2) as avg_wide_2022,
      round(avg(basic_sum), 2) as avg_narrow_2022
    from permonth
    where ym like '2022%'
    group by employee_id
  ),
  avg2023 as (
    select
      employee_id,
      round(avg(gross_sum), 2) as avg_wide_2023,
      round(avg(basic_sum), 2) as avg_narrow_2023
    from permonth
    where ym like '2023%'
    group by employee_id
  )
  insert into employee_baseline(
    employee_id,
    hire_date,
    first_payroll_month,
    first_insurance_month,
    first_month_base_wide,
    first_month_base_narrow,
    avg_wage_wide_2022,
    avg_wage_narrow_2022,
    avg_wage_wide_2023,
    avg_wage_narrow_2023,
    computed_at
  )
  select
    b.employee_id,
    b.hire_date,
    b.first_payroll_month,
    b.first_insurance_month,
    fb.first_wide,
    fb.first_narrow,
    a22.avg_wide_2022,
    a22.avg_narrow_2022,
    a23.avg_wide_2023,
    a23.avg_narrow_2023,
    now()
  from base b
  left join first_bases fb on fb.employee_id = b.employee_id
  left join avg2022 a22 on a22.employee_id = b.employee_id
  left join avg2023 a23 on a23.employee_id = b.employee_id
  on conflict (employee_id) do update set
    hire_date = excluded.hire_date,
    first_payroll_month = excluded.first_payroll_month,
    first_insurance_month = excluded.first_insurance_month,
    first_month_base_wide = excluded.first_month_base_wide,
    first_month_base_narrow = excluded.first_month_base_narrow,
    avg_wage_wide_2022 = excluded.avg_wage_wide_2022,
    avg_wage_narrow_2022 = excluded.avg_wage_narrow_2022,
    avg_wage_wide_2023 = excluded.avg_wage_wide_2023,
    avg_wage_narrow_2023 = excluded.avg_wage_narrow_2023,
    computed_at = now();
end;
$$;

-- 4.2) Refresh all employees
create or replace function refresh_employee_baseline_all()
returns integer
language plpgsql
as $$
declare
  cnt integer;
begin
  with permonth as (
    select
      sr.employee_id,
      sr.salary_month_std as ym,
      sum(sr.gross_salary)::numeric as gross_sum,
      sum(sr.basic_salary)::numeric as basic_sum
    from salary_records sr
    where sr.salary_month_std is not null
    group by sr.employee_id, sr.salary_month_std
  ),
  base as (
    select
      sr.employee_id,
      min(sr.hire_date)::date as hire_date,
      (select min(ym) from permonth p where p.employee_id = sr.employee_id and p.ym is not null) as first_payroll_month,
      compute_first_insurance_month(min(sr.hire_date)::date) as first_insurance_month
    from salary_records sr
    group by sr.employee_id
  ),
  first_bases as (
    select
      b.employee_id,
      pm.gross_sum as first_wide,
      pm.basic_sum as first_narrow
    from base b
    left join permonth pm
      on pm.employee_id = b.employee_id and pm.ym = b.first_insurance_month
  ),
  avg2022 as (
    select
      employee_id,
      round(avg(gross_sum), 2) as avg_wide_2022,
      round(avg(basic_sum), 2) as avg_narrow_2022
    from permonth
    where ym like '2022%'
    group by employee_id
  ),
  avg2023 as (
    select
      employee_id,
      round(avg(gross_sum), 2) as avg_wide_2023,
      round(avg(basic_sum), 2) as avg_narrow_2023
    from permonth
    where ym like '2023%'
    group by employee_id
  ),
  upserted as (
    insert into employee_baseline(
      employee_id,
      hire_date,
      first_payroll_month,
      first_insurance_month,
      first_month_base_wide,
      first_month_base_narrow,
      avg_wage_wide_2022,
      avg_wage_narrow_2022,
      avg_wage_wide_2023,
      avg_wage_narrow_2023,
      computed_at
    )
    select
      b.employee_id,
      b.hire_date,
      b.first_payroll_month,
      b.first_insurance_month,
      fb.first_wide,
      fb.first_narrow,
      a22.avg_wide_2022,
      a22.avg_narrow_2022,
      a23.avg_wide_2023,
      a23.avg_narrow_2023,
      now()
    from base b
    left join first_bases fb on fb.employee_id = b.employee_id
    left join avg2022 a22 on a22.employee_id = b.employee_id
    left join avg2023 a23 on a23.employee_id = b.employee_id
    on conflict (employee_id) do update set
      hire_date = excluded.hire_date,
      first_payroll_month = excluded.first_payroll_month,
      first_insurance_month = excluded.first_insurance_month,
      first_month_base_wide = excluded.first_month_base_wide,
      first_month_base_narrow = excluded.first_month_base_narrow,
      avg_wage_wide_2022 = excluded.avg_wage_wide_2022,
      avg_wage_narrow_2022 = excluded.avg_wage_narrow_2022,
      avg_wage_wide_2023 = excluded.avg_wage_wide_2023,
      avg_wage_narrow_2023 = excluded.avg_wage_narrow_2023,
      computed_at = now()
    returning 1
  )
  select count(*) into cnt from upserted;

  return cnt;
end;
$$;

-- 5) Warnings view: first_insurance_month present but base missing (flag for attention)
create or replace view employee_baseline_warnings as
select
  eb.employee_id,
  eb.first_insurance_month,
  eb.first_month_base_wide,
  eb.first_month_base_narrow
from employee_baseline eb
where eb.first_insurance_month is not null
  and (eb.first_month_base_wide is null or eb.first_month_base_narrow is null);
