# 会话截图插件的工作说明

## 这个项目是什么

一个DeepSeek Harness客户端插件：把一段对话渲染成PNG并写入剪贴板。它不占用宿主服务，也不保存状态：输入是页面自己的DOM，输出是剪贴板或一次下载。

| 部分 | 路径 |
| --- | --- |
| Host入口（故意留空） | `index.js` |
| 浏览器入口与注册 | `src/client/apply.js` |
| 数值与宿主标记 | `src/client/shell/const.js` |
| 文案表与语言接线 | `src/client/shell/i18n.js` |
| 状态与唯一的投递路径 | `src/client/shell/status.js` |
| 克隆准备与截图 | `src/client/dom/` |
| 渲染器、裁剪、画布预算 | `src/client/render/` |
| 剪贴板与下载 | `src/client/output/` |
| 按钮主体、入口、图标 | `src/client/views/` |
| 打包顺序 | `src/client/manifest.json` |
| 校验 | `checks/` |

`client.js`是生成物。改`src/client/`，再跑`node build.mjs`。

## 语言

代码、标识符、注释、提交说明与日志一律英文。面向用户的文案放在`src/client/shell/i18n.js`与`locale/`，两种语言的键必须一致，由校验脚本保证。文档以英文为主，另有`.zh-CN.md`版本。

## 设计规则

- 一件事只有一个位置：`dom/`读取并暂存页面，`render/`把舞台变成像素，`output/`交付字节，`views/`画控件，`shell/i18n.js`是唯一存放用户文案的地方。新出现的数字放进`const.js`，不要留在调用点。
- SVG渲染是主路径，手绘是退路。不要把退路“简化”掉：SVG文档并非总能解码，退路要在那时仍给出可读的图片。两条路径读的是同一份暂存克隆。
- 一切都在克隆上完成。实时输入框、滚动位置与宿主状态不得被截图写入，舞台存在的理由就在这里。
- 按几何裁剪，按标记删减。统计条没有稳定的外层容器，所以按最上面的`[data-composer-stat]`胶囊的位置切；界面部件按自己的属性删除。
- 样式表从源文本采集，不要从解析后的规则重建。`cssRules[i].cssText` 是引擎理解结果的序列化，写成`var()`的简写在那里会塌成空的长属性：宿主用`font: var(--dsw-font-markdown-code)`一次性设定 markdown 的字号、行高与字族，用解析结果重建样式表，图片里的行内代码就会用继承来的行高，「`」包住的片段比屏幕上高一截。因此读`<style>`的文本、抓`<link>`的文件，`serializeSheet`只作为取不到元素时的回退。
- 同一个标记可能被对话双方复用。每轮的消息元数据行都带`data-clock`，用户消息是`start`，回答是`end`，所以删减时按属性匹配，不认其中一个值。
- 截图要如实报告结果。历史拉不全时，提示条说明图片只含已加载的轮次；渲染器回退只写日志，不隐藏。
- 每个部分都要能被node单独导入：顶层声明写`export`（打包时会去掉），用到相邻部分的名称就写`import`，即使合并后的作用域会掩盖漏写。
- JavaScript源码行尾不写分号。`shell/style.js`里的CSS是模板字符串，自带分号，任何批量去分号的处理都必须跳过这个文件。
- 插件不声明Host侧`Config`，也不保存设置。截图功能不应该需要重启才生效。

## 验证

```bash
node build.mjs --check
node checks/structure.mjs
node checks/i18n.mjs
node checks/logic.mjs
```

三项校验覆盖打包契约、文案表与纯函数。它们看不出画面是否正确：要确认这一点，打开页面，点两个相机按钮，把结果粘贴出来看。

`apply`会挂上`window.__chatScreenshot`，插件卸载时删除。它带`captureConversation(anchor)`、`captureTurn(tail)`与`translate(key, vars)`。这个句柄的用途是在没有渲染出操作行的沙箱页面里单独验证某条路径：`captureTurn`接收`[data-turn-tail]`元素，`captureConversation`接收对话滚动容器内的任意元素，两者都返回截图对象，含blob、像素尺寸、缩放倍数与渲染器类型。

重新打包后的产物在组合时确定内容版本，运行中的宿主拿到的仍是旧字节：把插件关掉再打开，然后刷新页面。
