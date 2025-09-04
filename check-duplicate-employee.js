require('dotenv').config({ path: '.env.local' });

async function checkDuplicateEmployee() {
  console.log('🔍 检查重复员工记录\n');
  console.log('=' .repeat(70));

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  // 查询DF-3589在2022年5月的记录
  console.log('🔍 查询DF-3589在2022年5月的数据库记录...');
  
  const { data: dbRecords, error: dbError } = await supabase
    .from('salary_records')
    .select('employee_id, hire_date, basic_salary, gross_salary, xuhao2, created_at')
    .eq('salary_month', '2022年5月')
    .eq('employee_id', 'DF-3589')
    .order('created_at');
  
  if (dbError) {
    console.error('❌ 查询失败:', dbError.message);
    return;
  }
  
  console.log(`   数据库中DF-3589记录: ${dbRecords?.length || 0} 条`);
  
  if (dbRecords && dbRecords.length > 0) {
    dbRecords.forEach((record, idx) => {
      console.log(`   ${idx + 1}. 序号${record.xuhao2} | 入厂时间: ${record.hire_date} | ￥${record.basic_salary}/￥${record.gross_salary}`);
    });
  }
  
  // 验证唯一约束的作用
  console.log('\n💡 问题分析:');
  console.log('   Excel中DF-3589有2条记录:');
  console.log('   - 序号156: 入厂时间 2022-04-06');
  console.log('   - 序号157: 入厂时间 2022-05-17');
  console.log('');
  console.log('   由于数据库有 UNIQUE(employee_id, salary_month) 约束');
  console.log('   同一员工在同一月份只能有一条记录');
  console.log('   所以第二条记录被upsert操作覆盖/忽略了');
  
  // 尝试手动插入第二条记录验证推测
  console.log('\n🧪 验证唯一约束推测...');
  
  const testRecord1 = {
    employee_id: 'TEST-DUP-001',
    hire_date: '2022-04-06',
    salary_month: '2022年5月',
    basic_salary: 2906,
    gross_salary: 7669.2,
    xuhao: '2022年5月-998',
    xuhao2: 998
  };
  
  const testRecord2 = {
    employee_id: 'TEST-DUP-001', // 同一员工
    hire_date: '2022-05-17',      // 不同入厂时间
    salary_month: '2022年5月',    // 同一月份
    basic_salary: 2218,
    gross_salary: 4860.7,
    xuhao: '2022年5月-999',
    xuhao2: 999
  };
  
  // 先插入第一条
  const { error: error1 } = await supabase
    .from('salary_records')
    .insert(testRecord1);
  
  if (error1) {
    console.log(`   ❌ 第一条插入失败: ${error1.message}`);
  } else {
    console.log(`   ✅ 第一条插入成功`);
    
    // 再插入第二条（应该被upsert覆盖）
    const { error: error2 } = await supabase
      .from('salary_records')
      .upsert(testRecord2, { onConflict: 'employee_id,salary_month' });
    
    if (error2) {
      console.log(`   ❌ 第二条upsert失败: ${error2.message}`);
    } else {
      console.log(`   ✅ 第二条upsert成功（覆盖第一条）`);
      
      // 查看最终记录
      const { data: finalRecord } = await supabase
        .from('salary_records')
        .select('hire_date, basic_salary, gross_salary, xuhao2')
        .eq('employee_id', 'TEST-DUP-001')
        .eq('salary_month', '2022年5月')
        .single();
      
      if (finalRecord) {
        console.log(`   最终保存的记录: 序号${finalRecord.xuhao2} | 入厂时间: ${finalRecord.hire_date} | ￥${finalRecord.basic_salary}/￥${finalRecord.gross_salary}`);
        
        if (finalRecord.xuhao2 === 999) {
          console.log(`   🎯 确认: upsert操作保留了后插入的记录（序号999），覆盖了先插入的记录（序号998）`);
        }
      }
    }
    
    // 清理测试数据
    await supabase
      .from('salary_records')
      .delete()
      .eq('employee_id', 'TEST-DUP-001');
  }
  
  console.log('\n💡 解决方案建议:');
  console.log('   1. 这是数据质量问题：同一员工在Excel中有多条记录且入厂时间不一致');
  console.log('   2. 需要决定保留哪条记录：第一条还是最后一条？');
  console.log('   3. 或者修改数据库结构，允许同一员工多条记录');
  console.log('   4. 或者在解析时合并/去重处理');
}

checkDuplicateEmployee().catch(console.error);