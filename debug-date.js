console.log('🔍 调试日期转换问题...\n');

// 测试日期字符串 "2017/04/01"
const testDateStr = "2017/04/01";
console.log(`原始日期字符串: ${testDateStr}`);

// 方法1: 当前的转换方式
const [year1, month1, day1] = testDateStr.split('/').map(s => parseInt(s));
const date1 = new Date(Date.UTC(year1, month1 - 1, day1));
console.log(`方法1 (当前): ${date1.toISOString().split('T')[0]} (年=${year1}, 月=${month1}, 日=${day1})`);

// 方法2: 直接使用Date构造
const date2 = new Date(testDateStr);
console.log(`方法2 (直接): ${date2.toISOString().split('T')[0]}`);

// 方法3: 使用更安全的UTC时间
const [year3, month3, day3] = testDateStr.split('/').map(s => parseInt(s));
const date3 = new Date(Date.UTC(year3, month3 - 1, day3));
console.log(`方法3 (UTC): ${date3.toISOString().split('T')[0]}`);

// 方法4: 添加时区偏移补偿
const date4 = new Date(testDateStr + 'T12:00:00.000Z');
console.log(`方法4 (中午UTC): ${date4.toISOString().split('T')[0]}`);

console.log('\n🕐 时区信息:');
console.log(`本地时区偏移: ${new Date().getTimezoneOffset()} 分钟`);
console.log(`当前时间: ${new Date().toISOString()}`);