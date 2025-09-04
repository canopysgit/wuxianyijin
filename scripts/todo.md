建统计表

建表: employee_wage_stats（字段：employee_id PK、hire_date、first_salary_month、first_gross、avg_2022_gross、avg_2023_gross、months_2022、months_2023、updated_at）
写一条 SQL 刷新语句：规范化工资月份（提取年/月→make_date），求“最早工资月/首月工资”和“2022/2023年均”，insert … on conflict do update
先刷新统计

执行“全量 upsert”SQL，生成/更新 employee_wage_stats（一次完成）
合并单脚本

仅保留 batch_calculate_2023_h1_all.js 为入口
修复 env 读取（.env.local），使用 service role
读取在职集合：一次性查出 2023年1–6月在职员工（按中文工资月 IN）
读取统计：一次性从 employee_wage_stats 按 employee_id IN 拉回（含 hire_date、first_gross、avg_2022_gross）
参考基数规则（2023H1）

老员工: hire_date < 2022-01-01 → 使用 avg_2022_gross
其他: 使用 first_gross
统一四舍五入两位；工伤不夹逼
先删后插

删除 calculate_result_2023_h1_wide 中 calculation_month ∈ {202301..202306}
生成并插入

合成 202301..202306 全部行（仅对当月在职员工）
2k–5k/批插入，insert(rows, { returning: 'minimal' })
日志只打印批次计数与耗时
快速验收

每月“写入行数 = 当月在职员工数”
抽查若干行：2023H1 老员工的 reference_wage_base ≈ avg_2022_gross；非老员工≈first_gross
抽查 5 行：金额 ≈ 基数×费率（容差：金额±0.1、基数±0.01）
后续复用

继续用 employee_wage_stats 支撑 2023H2/2024H1/2024H2（只要刷新一次统计即可）
如需“首个完整参保月”判定，再迭代统计表的 first_gross产生逻辑（可加策略字段和标记）