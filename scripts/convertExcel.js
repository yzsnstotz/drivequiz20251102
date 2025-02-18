import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 确保目录存在
const zhQuestionsDir = path.join(__dirname, '../src/data/questions/zh');
const zhImagesDir = path.join(__dirname, '../src/assets/images/questions/zh');
fs.mkdirSync(zhQuestionsDir, { recursive: true });
fs.mkdirSync(zhImagesDir, { recursive: true });

// 下载图片的函数
async function downloadImage(url, filename, retries = 3) {
  if (!url) return null;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive'
  };

  const downloadWithRetry = async (attempt = 1) => {
    try {
      return await new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const request = protocol.get(url, { headers }, (response) => {
          // 处理重定向
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              console.log(`重定向到: ${redirectUrl}`);
              downloadImage(redirectUrl, filename, retries - 1)
                .then(resolve)
                .catch(reject);
              return;
            }
          }

          if (response.statusCode !== 200) {
            reject(new Error(`下载图片失败: ${response.statusCode}`));
            return;
          }

          const fileStream = fs.createWriteStream(filename);
          response.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            resolve(filename);
          });

          fileStream.on('error', (err) => {
            fs.unlink(filename, () => {}); // 删除失败的文件
            reject(err);
          });
        });

        request.on('error', reject);
      });
    } catch (error) {
      if (attempt < retries) {
        console.log(`第 ${attempt} 次下载失败，正在重试...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        return downloadWithRetry(attempt + 1);
      }
      throw error;
    }
  };

  return downloadWithRetry();
}

// 处理Excel文件
async function processExcel(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet, { header: ['content', 'image', 'answer', 'explanation'] });
      
      // 移除表头
    //   data.shift();

      const questions = await Promise.all(data.map(async (row, index) => {
        let imageUrl = row.image;

        // 如果有图片URL，下载并保存
        // if (row.image) {
        //   const imageFileName = `${sheetName}_${index + 1}${path.extname(row.image)}`;
        //   const imagePath = path.join(zhImagesDir, imageFileName);
          
        //   try {
        //     await downloadImage(row.image, imagePath);
        //     imageUrl = `/assets/images/questions/zh/${imageFileName}`;
        //   } catch (error) {
        //     console.error(`Failed to download image for question ${index + 1} in ${sheetName}:`, error);
        //   }
        // }

        return {
          id: index + 1,
          type: 'truefalse',
          content: row.content,
          image: imageUrl,
          correctAnswer: row.answer.toLowerCase() === 'o' ? 'true' : 'false',
          explanation: row.explanation || ''
        };
      }));

      // 保存为JSON文件
      const jsonContent = {
        questions
      };

      fs.writeFileSync(
        path.join(zhQuestionsDir, `${sheetName}.json`),
        JSON.stringify(jsonContent, null, 2),
        'utf8'
      );

      console.log(`Processed ${sheetName}: ${questions.length} questions`);
    }

    console.log('Excel processing completed!');
  } catch (error) {
    console.error('Error processing Excel file:', error);
  }
}

// 运行脚本
processExcel('/Users/kk/Downloads/中文题目.xlsx');