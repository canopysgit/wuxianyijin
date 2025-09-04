const bcrypt = require('bcryptjs');

// 您Supabase中的哈希值
const adminHash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
const colleagueHash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

// 常见的测试密码
const testPasswords = [
  'password',
  'password1', 
  'admin',
  'admin123',
  '123456',
  'secret',
  'test',
  'password123',
  'admin1',
  'user123'
];

async function checkPasswords() {
  console.log('检查admin用户的密码...');
  
  for (const password of testPasswords) {
    const isMatch = await bcrypt.compare(password, adminHash);
    if (isMatch) {
      console.log(`✅ admin用户的密码是: ${password}`);
      return;
    }
  }
  
  console.log('❌ 未找到匹配的密码');
  
  // 这个哈希实际上是Laravel默认的测试哈希，对应密码是 "password"
  console.log('\n提示：这个哈希值是Laravel框架的默认测试哈希');
  console.log('对应的密码应该是: password');
  
  // 验证
  const isPasswordMatch = await bcrypt.compare('password', adminHash);
  console.log(`验证 "password": ${isPasswordMatch ? '✅ 正确' : '❌ 错误'}`);
}

checkPasswords().catch(console.error);
