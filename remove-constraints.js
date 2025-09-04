require('dotenv').config({ path: '.env.local' });

async function removeConstraints() {
  console.log('🔧 移除数据库约束\n');
  
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // 尝试删除约束 (基于错误信息中的约束名)
    console.log('🗑️ 尝试移除 salary_records_check 约束...');
    
    // 由于我们不能直接执行DDL，让我们先看看能否通过违反约束的方式了解约束内容
    console.log('💡 尝试插入测试数据来触发约束错误...');
    
    const testRecord = {
      employee_id: 'TEST-CONSTRAINT',
      hire_date: '2022-01-01',
      salary_month: '2022年1月',
      basic_salary: 3600, // 大于 gross_salary
      gross_salary: 2988,
      xuhao: '2022年1月-999',
      xuhao2: 999
    };
    
    const { error: insertError } = await supabase
      .from('salary_records')
      .insert(testRecord);
    
    if (insertError) {
      console.log('❌ 约束错误详情:', insertError);
      console.log('   代码:', insertError.code);
      console.log('   消息:', insertError.message);
      console.log('   详情:', insertError.details);
    } else {
      console.log('✅ 插入成功，无约束问题');
      
      // 清理测试数据
      await supabase
        .from('salary_records')
        .delete()
        .eq('employee_id', 'TEST-CONSTRAINT');
    }
    
    // 尝试从错误日志推断约束条件并提供解决方案
    console.log('\n💡 解决方案:');
    console.log('   根据错误信息，数据库表存在检查约束阻止基本工资>应发工资的记录');
    console.log('   需要通过Supabase Dashboard的SQL编辑器执行以下命令:');
    console.log('');
    console.log('   ALTER TABLE salary_records DROP CONSTRAINT salary_records_check;');
    console.log('');
    console.log('   或者如果约束名不同，先查询约束名:');
    console.log('   SELECT conname FROM pg_constraint WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = \'salary_records\');');
    
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
  }
}

removeConstraints();