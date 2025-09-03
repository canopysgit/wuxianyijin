-- Backfill employee_baseline and show warnings
select refresh_employee_baseline_all();

-- Inspect warnings: first_insurance_month present but base missing
select * from employee_baseline_warnings;

