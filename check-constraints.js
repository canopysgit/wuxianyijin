require('dotenv').config({ path: '.env.local' });

async function checkConstraints() {
  console.log('🔍 检查数据库约束\n');
  
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // 查询约束信息
    const { data, error } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT 
          conname as constraint_name, 
          consrc as check_condition,
          contype as constraint_type
        FROM pg_constraint 
        WHERE conrelid = (
          SELECT oid FROM pg_class WHERE relname = 'salary_records'
        ) 
        AND contype = 'c';
      `
    });
    
    if (error) {
      console.error('❌ 查询失败:', error);
      return;
    }
    
    console.log(`📋 salary_records表的检查约束:`);
    if (data && data.length > 0) {
      data.forEach((constraint, idx) => {
        console.log(`   ${idx + 1}. ${constraint.constraint_name}: ${constraint.check_condition}`);
      });
    } else {
      console.log('   无检查约束');
    }
    
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
  }
}

checkConstraints();