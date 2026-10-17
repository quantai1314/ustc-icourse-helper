# USTC 评课社区助手 (USTC Icourse Helper)

为 [USTC 评课社区](https://icourse.club)（icourse.club）增强的油猴脚本。基于 [PRO 的 USTC Helper](https://greasyfork.org/zh-CN/scripts/453530-ustc-helper)（GPL-3.0）的 icourse 模块提取并改进，**无任何外部依赖**。

## 功能

- **悬浮资料面板**：页面右边缘常驻一个竖排小按钮「资料 N+M」，点击展开汇总面板；首次进入自动展开几秒提示存在感。面板不随页面滚动消失，点「定位」后仍可继续浏览其他条目
- **文件列表**：自动收集课程点评区的所有附件（讲义、试卷、复习提纲等），点击直接下载（自动补全文件名）
- **链接列表**：自动收集点评区的所有外部链接，新标签页打开
- **定位**：本页条目带「定位」按钮，滚动到原点评并闪烁高亮
- **搜集其他老师的同课程资料**：点面板底部按钮，自动抓取侧边栏「其他老师的课」列出的所有课程页，把其中的附件和链接合并进列表（灰色小字标注来源老师，点击可前往对应课程页）；当日结果缓存于 localStorage，同一天内不重复抓取
- **未登录也能用**：评课社区对未登录用户隐藏附件直链，但保留文件名——脚本会列出这些附件并提示登录后下载；文件本身其实是公开可下载的，登录后自动变为直链

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 点击安装：[USTC-Icourse-Helper.user.js](https://github.com/quantai1314/ustc-icourse-helper/raw/main/USTC-Icourse-Helper.user.js)（或从 Greasyfork 安装，链接待补充）

## 说明

- 仅在课程详情页（`/course/<id>/`）生效
- 纯本地运行，不与任何第三方通信；抓取其他老师课程页仅在点击按钮后发生
- 相比原模块的改进：改为悬浮面板常驻、过滤了无效的 `#` 锚点链接和登录弹窗链接、新增未登录用户的附件识别、新增跨老师资料搜集与同页去重

## License

[GPL-3.0](LICENSE) — 与上游 USTC Helper 保持一致
