import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 创建管理员客户端
const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceRoleKey);

// 将工资月份标准化为 YYYYMM（作为兜底，正常应由前端或导入脚本提供 std 值）
function toHalfWidth(input: string): string {
  const full = '０１２３４５６７８９／－—　';
  const half = '0123456789/-- ';
  return input.split('').map(ch => {
    const idx = full.indexOf(ch);
    return idx >= 0 ? half[idx] : ch;
  }).join('');
}

function normSalaryMonthStd(raw: any): string | null {
  if (raw == null) return null;
  let t = String(raw).trim();
  if (!t) return null;
  t = toHalfWidth(t);

  const m6 = t.match(/^([0-9]{4})([0-9]{2})$/);
  if (m6) {
    const mm = parseInt(m6[2], 10);
    return mm >= 1 && mm <= 12 ? m6[1] + m6[2] : null;
  }

  let m = t.match(/([0-9]{4})[^0-9]*?([0-9]{1,2})\s*月/);
  if (m) {
    const y = m[1]; const mon = parseInt(m[2], 10);
    return mon >= 1 && mon <= 12 ? y + String(mon).padStart(2, '0') : null;
  }

  m = t.match(/([0-9]{4})[^0-9]*?([0-9]{2})([^0-9]|$)/) || t.match(/([0-9]{4})[^0-9]*?([0-9])([^0-9]|$)/);
  if (m) {
    const y = m[1]; const mon = parseInt(m[2], 10);
    return mon >= 1 && mon <= 12 ? y + String(mon).padStart(2, '0') : null;
  }

  const cmap: Record<string, number> = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 };
  m = t.match(/([0-9]{4})[^0-9]*?([一二三四五六七八九十〇零]{1,3})\s*月/);
  if (m) {
    const y = m[1];
    let cn = m[2].replace(/〇/g,'零');
    let mon: number | undefined;
    if (cn === '十') mon = 10;
    else if (cn === '十一') mon = 11;
    else if (cn === '十二') mon = 12;
    else if (cn.length === 1 && cmap[cn]) mon = cmap[cn];
    else if (cn.length === 2 && cn.startsWith('十') && cmap[cn[1]]) mon = 10 + cmap[cn[1]];
    return mon && mon >= 1 && mon <= 12 ? y + String(mon).padStart(2,'0') : null;
  }

  const ycn = t.match(/([〇零一二三四五六七八九]{4})/);
  const mcn = t.match(/[〇零一二三四五六七八九]{4}[^0-9一二三四五六七八九十〇零]*?([一二三四五六七八九十〇零]{1,3})\s*月/);
  if (ycn && mcn) {
    const ymap: Record<string,string> = { '零':'0','一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','〇':'0' };
    const y = ycn[1].split('').map(c => ymap[c] ?? '').join('');
    let cn = mcn[1].replace(/〇/g,'零');
    let mon: number | undefined;
    if (cn === '十') mon = 10;
    else if (cn === '十一') mon = 11;
    else if (cn === '十二') mon = 12;
    else if (cn.length === 1 && cmap[cn]) mon = cmap[cn];
    else if (cn.length === 2 && cn.startsWith('十') && cmap[cn[1]]) mon = 10 + cmap[cn[1]];
    return y && y.length === 4 && mon && mon >= 1 && mon <= 12 ? y + String(mon).padStart(2,'0') : null;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { records } = await request.json();

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: '缺少有效的工资记录数据' },
        { status: 400 }
      );
    }

    console.log(`📊 开始导入 ${records.length} 条工资记录...`);
    
    const startTime = Date.now();
    const batchSize = 100;
    let importedRecords = 0;
    let failedRecords = 0;
    const errors: any[] = [];
    
    // 计算总批次数
    const totalBatches = Math.ceil(records.length / batchSize);
    console.log(`📦 将分 ${totalBatches} 批处理，每批 ${batchSize} 条记录`);

    // 分批处理
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      console.log(`📦 处理第 ${batchNumber}/${totalBatches} 批 (${batch.length} 条记录)`);
      
      try {
        // 为每条记录补充标准月份列（兜底）
        const enriched = batch.map((r: any) => ({
          ...r,
          salary_month_std: r.salary_month_std ?? normSalaryMonthStd(r.salary_month)
        }));

        const { error, count } = await supabaseAdmin
          .from('salary_records')
          .upsert(enriched as any, {
            onConflict: 'employee_id,salary_month',
            count: 'exact'
          });

        if (error) {
          console.error(`❌ 第 ${batchNumber} 批批量插入错误:`, error);
          
          // 逐个插入处理错误
          let batchSuccess = 0;
          for (const record of enriched) {
            try {
              await supabaseAdmin
                .from('salary_records')
                .upsert(record, { 
                  onConflict: 'employee_id,salary_month' 
                });
              importedRecords++;
              batchSuccess++;
            } catch (singleError: any) {
              failedRecords++;
              errors.push({
                employeeId: record.employee_id,
                salaryMonth: record.salary_month,
                error: singleError.message || '未知错误'
              });
            }
          }
          console.log(`✅ 第 ${batchNumber} 批逐个处理完成: ${batchSuccess}/${batch.length} 成功`);
        } else {
          importedRecords += count || batch.length;
          console.log(`✅ 第 ${batchNumber} 批成功导入 ${count || batch.length} 条记录`);
        }
      } catch (batchError: any) {
        failedRecords += batch.length;
        batch.forEach(record => {
          errors.push({
            employeeId: record.employee_id,
            salaryMonth: record.salary_month,
            error: batchError.message || '批量处理失败'
          });
        });
      }
    }

    const duration = Date.now() - startTime;
    
    console.log(`🎉 导入完成! 总计: ${records.length}, 成功: ${importedRecords}, 失败: ${failedRecords}, 耗时: ${duration}ms`);

    // 🔍 导入后验证：确保数据库中的记录数与导入数一致
    console.log(`🔍 开始导入后验证...`);
    let validationSuccess = true;
    const validationErrors: string[] = [];
    
    try {
      // 按salary_month分组验证
      const monthGroups: Record<string, number> = {};
      records.forEach(record => {
        monthGroups[record.salary_month] = (monthGroups[record.salary_month] || 0) + 1;
      });
      
      for (const [salaryMonth, expectedCount] of Object.entries(monthGroups)) {
        const { count: actualCount, error: countError } = await supabaseAdmin
          .from('salary_records')
          .select('*', { count: 'exact', head: true })
          .eq('salary_month', salaryMonth);
        
        if (countError) {
          validationErrors.push(`验证"${salaryMonth}"时数据库查询失败: ${countError.message}`);
          validationSuccess = false;
        } else if (actualCount !== expectedCount) {
          const discrepancy = expectedCount - (actualCount || 0);
          validationErrors.push(`"${salaryMonth}"数量不匹配: 预期${expectedCount}, 实际${actualCount}, 差异${discrepancy}`);
          validationSuccess = false;
        } else {
          console.log(`✅ "${salaryMonth}"验证通过: ${actualCount}/${expectedCount} 条记录`);
        }
      }
      
      if (validationSuccess && failedRecords === 0) {
        console.log(`✅ 导入验证成功: 所有数据已正确保存到数据库`);
      } else {
        console.log(`❌ 导入验证失败: ${validationErrors.length}个问题`);
      }
      
    } catch (validationError: any) {
      validationErrors.push(`验证过程异常: ${validationError.message}`);
      validationSuccess = false;
      console.error(`❌ 验证过程异常:`, validationError);
    }

    return NextResponse.json({
      success: failedRecords === 0 && validationSuccess,
      totalRecords: records.length,
      importedRecords,
      failedRecords,
      errors,
      duration,
      validation: {
        postImportCheck: validationSuccess,
        validationErrors,
        consistencyVerified: validationSuccess && failedRecords === 0
      },
      batchInfo: {
        totalBatches,
        batchSize,
        processedBatches: totalBatches
      }
    });

  } catch (error: any) {
    console.error('API错误:', error);
    return NextResponse.json(
      { error: error.message || '导入过程发生未知错误' },
      { status: 500 }
    );
  }
}
