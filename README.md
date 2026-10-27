# 建模共享台

面向约 100 人共同使用的公开文件共享网站。打开页面即可上传文件，内容分为“题目、文章、代码”三个公开分区，所有访问者都能浏览和下载其他人的内容。

正式网址：https://qiruipeng922-create.github.io/model-commons/

GitHub 仓库：https://github.com/qiruipeng922-create/model-commons

## 本地运行

```bash
npm install
npm start
```

打开 http://localhost:4173。静态网站也可以直接用任意静态文件服务器预览。

## 云端结构

正式版本不依赖本项目所在的电脑：

- 页面托管：GitHub Pages
- 文件暂存：Litterbox，当前文件保留约 72 小时
- 公共目录：MantleDB，每个分区使用 3 个匿名命名空间分片
- 前端配置：`public/config.js`

静态版本的文件与索引直接由浏览器写入云端服务，因此关闭本机后仍可访问网站和已暂存的文件。

## 长期存储

当前临时文件服务约 72 小时后清理文件，且不同服务有单分区条目上限。长期上线时应将 `public/config.js` 和上传逻辑切换到正式对象存储、数据库和鉴权服务，例如 Cloudflare R2、Supabase Storage 或自建服务器。

## 支持的文件

- 论文：PDF、DOC/DOCX、TEX、BIB
- 代码与压缩包：ZIP、RAR、7Z、TAR、GZ、Python、R、MATLAB、Julia、C/C++、Java、JavaScript、SQL 等
- 数据与附件：CSV、XLSX、JSON、YAML、MAT、图片、演示文档、音视频

前端会校验扩展名与文件大小，并拒绝常见可执行文件类型。正式部署后仍建议增加服务端病毒扫描与内容审核。

## 正式上线建议

当前版本适合约 100 人测试使用。长期运行建议补充：

1. 接入对象存储、病毒扫描、用户配额和生命周期清理。
2. 增加管理员后台、删除权限、截止时间和审计日志。
3. 启用访问密码、学校 SSO 或 OAuth。
4. 将匿名云端索引替换为带鉴权的正式数据库。
