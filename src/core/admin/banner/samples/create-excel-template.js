import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createExcelTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Banners');

  // Define columns
  worksheet.columns = [
    { header: 'title', key: 'title', width: 30 },
    { header: 'subtitle', key: 'subtitle', width: 40 },
    { header: 'mediaUrl', key: 'mediaUrl', width: 50 },
    { header: 'urlTarget', key: 'urlTarget', width: 50 },
    { header: 'isActive', key: 'isActive', width: 15 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // Add sample data
  worksheet.addRows([
    {
      title: 'Summer Sale Banner',
      subtitle: 'Get 50% off on all items',
      mediaUrl: 'http://picsum.photos/720/300',
      urlTarget: 'https://example.com/summer-sale',
      isActive: true,
    },
    {
      title: 'Winter Collection',
      subtitle: 'New arrivals for winter season',
      mediaUrl: 'http://picsum.photos/720/300',
      urlTarget: 'https://example.com/winter',
      isActive: 1,
    },
    {
      title: 'Spring Discount',
      subtitle: 'Limited time offer',
      mediaUrl: 'http://picsum.photos/720/300',
      urlTarget: 'https://example.com/spring',
      isActive: 'yes',
    },
    {
      title: 'Fall Special',
      subtitle: 'Best deals of the season',
      mediaUrl: 'http://picsum.photos/720/300',
      urlTarget: 'https://example.com/fall',
      isActive: true,
    },
    {
      title: 'Holiday Banner',
      subtitle: 'Celebrate with us',
      mediaUrl: 'http://picsum.photos/720/300',
      urlTarget: '',
      isActive: 1,
    },
  ]);

  // Save workbook
  const filePath = path.join(__dirname, 'banner-import-template.xlsx');
  await workbook.xlsx.writeFile(filePath);
  console.log(`Excel template created successfully at: ${filePath}`);
}

createExcelTemplate().catch(console.error);
