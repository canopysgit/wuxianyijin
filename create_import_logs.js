const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0NDc2NjIsImV4cCI6MjA1MTAyMzY2Mn0.h8SaQJL4t0CgNvpz0PgiqrOb6--t5dXL4G1BpMCCzs8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createImportLogsTable() {
  console.log('🏗️ 创建 import_logs 表...');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS import_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      file_name TEXT NOT NULL,
      import_type TEXT NOT NULL,
      records_imported INTEGER NOT NULL DEFAULT 0,
      records_updated INTEGER NOT NULL DEFAULT 0,
      records_failed INTEGER NOT NULL DEFAULT 0,
      error_details JSONB,
      import_duration_ms INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_import_logs_created_at ON import_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_import_logs_import_type ON import_logs(import_type);
  `;
  
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (error && !error.message.includes('already exists')) {
      throw error;
    }
    
    console.log('✅ import_logs 表创建成功');
    
    // 验证表结构
    const { data, error: queryError } = await supabase
      .from('import_logs')
      .select('*', { count: 'exact', head: true });
    
    if (queryError) {
      throw queryError;
    }
    
    console.log('✅ 表结构验证成功');
    
  } catch (error) {
    console.error('❌ 创建表失败:', error.message);
  }
}

createImportLogsTable();