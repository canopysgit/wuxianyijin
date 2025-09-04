const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0NDc2NjIsImV4cCI6MjA1MTAyMzY2Mn0.h8SaQJL4t0CgNvpz0PgiqrOb6--t5dXL4G1BpMCCzs8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testTableAccess() {
  console.log('🔍 检查现有表状态...');
  
  // 检查salary_records表
  try {
    const { count, error } = await supabase
      .from('salary_records')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ salary_records表访问失败:', error.message);
    } else {
      console.log(`✅ salary_records表存在，记录数: ${count}`);
    }
  } catch (error) {
    console.log('❌ salary_records表检查错误:', error.message);
  }
  
  // 检查policy_rules表  
  try {
    const { count, error } = await supabase
      .from('policy_rules')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ policy_rules表访问失败:', error.message);
    } else {
      console.log(`✅ policy_rules表存在，记录数: ${count}`);
    }
  } catch (error) {
    console.log('❌ policy_rules表检查错误:', error.message);
  }
  
  // 检查import_logs表是否存在
  try {
    const { count, error } = await supabase
      .from('import_logs')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ import_logs表不存在或访问失败:', error.message);
      
      // 尝试插入一条测试记录来创建表（如果RLS允许）
      console.log('🔄 尝试创建导入日志记录...');
      const { error: insertError } = await supabase
        .from('import_logs')
        .insert({
          file_name: 'test.xlsx',
          import_type: 'salary_data',
          records_imported: 0,
          records_updated: 0,
          records_failed: 0,
          import_duration_ms: 100
        });
      
      if (insertError) {
        console.log('❌ 无法创建导入日志:', insertError.message);
      } else {
        console.log('✅ import_logs表创建成功');
      }
    } else {
      console.log(`✅ import_logs表存在，记录数: ${count}`);
    }
  } catch (error) {
    console.log('❌ import_logs表检查错误:', error.message);
  }
}

testTableAccess();