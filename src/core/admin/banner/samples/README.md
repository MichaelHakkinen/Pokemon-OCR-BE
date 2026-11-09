# Banner Import Templates

This folder contains sample templates for importing banners into the system.

## Files

### 1. `banner-import-template.csv`

A CSV template with sample banner data. Use this as a reference for creating your own CSV import files.

### 2. `banner-import-template.xlsx`

An Excel template with sample banner data. Use this as a reference for creating your own Excel import files.

### 3. `create-excel-template.js`

A Node.js script used to generate the Excel template. You can modify and run this script if you need to regenerate the template.

## How to Use

1. Download either the CSV or Excel template
2. Replace the sample data with your actual banner information
3. Ensure the `mediaUrl` column contains valid file paths or URLs
4. Upload the file using the Banner Import API endpoint: `POST /banner/import`

## Column Descriptions

| Column    | Description                            | Required | Example Values                 |
| --------- | -------------------------------------- | -------- | ------------------------------ |
| title     | Banner title                           | No       | "Summer Sale Banner"           |
| subtitle  | Banner subtitle                        | No       | "Get 50% off on all items"     |
| mediaUrl  | Path or URL to banner image            | **Yes**  | "http://picsum.photos/720/300" |
| urlTarget | URL to redirect when banner is clicked | No       | "https://example.com/sale"     |
| isActive  | Whether banner is active               | No       | true, 1, yes (default: true)   |

## Notes

- The `mediaUrl` field is required for all banners
- Column names are case-insensitive
- Boolean values can be: true/false, 1/0, yes/no
- Empty cells are treated as null values
- Maximum file size: 10MB
- For testing, you can use `http://picsum.photos/720/300` which provides random photos with 720x300 dimensions

For more detailed API documentation, see [BANNER_IMPORT_API.md](../BANNER_IMPORT_API.md)
