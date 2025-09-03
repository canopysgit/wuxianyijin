-- 1) Add standard month column (YYYYMM as text)
alter table if exists salary_records
  add column if not exists salary_month_std text;

-- 2) Backfill using our robust normalizer
update salary_records
set salary_month_std = normalize_month_yyyymm(salary_month::text)
where salary_month_std is distinct from normalize_month_yyyymm(salary_month::text);

-- 3) Optional: analyze to help planner
analyze salary_records;

-- 4) Add CHECK constraint for YYYYMM format (01-12)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_salary_month_std_yyyymm'
  ) then
    alter table salary_records add constraint chk_salary_month_std_yyyymm
      check (
        salary_month_std is null or (
          salary_month_std ~ '^[0-9]{6}$' and
          substring(salary_month_std,5,2)::int between 1 and 12
        )
      );
  end if;
end$$;

-- 5) Index for lookups by standard month
create index if not exists idx_salary_records_month_std
  on salary_records(salary_month_std);

-- 6) (Defer) Unique safety: only add after verifying no dups/nulls
-- create unique index idx_salary_records_unique_std
--   on salary_records(employee_id, salary_month_std)
--   where salary_month_std is not null;

-- 7) Diagnostics
-- 7.1 Nulls after backfill (should be 0 or a small number to fix manually)
select count(*) as null_std_count from salary_records where salary_month_std is null;
select employee_id, salary_month from salary_records where salary_month_std is null limit 50;

-- 7.2 Potential duplicates on std month (should be 0 unless true multi-row months exist)
select employee_id, salary_month_std, count(*) as cnt
from salary_records
where salary_month_std is not null
group by employee_id, salary_month_std
having count(*) > 1
order by cnt desc, employee_id, salary_month_std;

