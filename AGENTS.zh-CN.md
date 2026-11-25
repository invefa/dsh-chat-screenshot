# 会话截图插件的工作说明

## 这个项目是什么

一个DeepSeek Harness客户端插件：把一段对话渲染成PNG并写入剪贴板。它不占用宿主服务：输入是页面自己的DOM，输出是剪贴板或一次下载；唯一的持久化是浏览器`localStorage`里的一条偏好。

| 部分 | 路径 |
| --- | --- |
| Host入口（故意留空） | `index.js` |
| 浏览器入口与注册 | `src/client/apply.js` |
| 数值与宿主标记 | `src/client/shell/const.js` |
| 偏好读写的唯一入口 | `src/client/shell/options.js` |
| 文案表与语言接线 | `src/client/shell/i18n.js` |
| 状态与唯一的投递路径 | `src/client/shell/status.js` |
| 克隆准备、剪枝与插入块 | `src/client/dom/` |
| 渲染器、裁剪、画布预算 | `src/client/render/` |
| 剪贴板与下载 | `src/client/output/` |
| 按钮、菜单、选择器、设置页、图标 | `src/client/views/` |
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
- 样式表从源文本采集，不要从解析后的规则重建。`cssRules[i].cssText`是引擎理解结果的序列化，写成`var()`的简写在那里会塌成空的长属性：宿主用`font: var(--dsw-font-markdown-code)`一次性设定markdown的字号、行高与字族，用解析结果重建样式表，行内代码就会用继承来的行高，胶囊高出几像素。因此读`<style>`的文本、抓`<link>`的文件，`serializeSheet`只作为取不到元素时的回退。
- 同一个标记可能被对话双方复用。每轮的消息元数据行都带`data-clock`，用户消息是`start`，回答是`end`，所以删减时按属性匹配，不认其中一个值。
- 截图要如实报告结果。历史拉不全时，提示条说明图片只含已加载的轮次；渲染器回退只写日志，不隐藏。
- 分页控件不会消失。它留在布局里，变成`disabled`，可见标签换成“已到会话开头”，而且五个标签同时存在、非当前项带`aria-hidden`。读可见标签，把`disabled`或`start`当作“历史已到底”，不要在busy或disabled时点击：正因为它看着像可点的按钮，截图才会在一段已经到底的对话上空转完整个历史预算。
- 设置在图片里加入的内容建在暂存克隆内部，位置在首轮之上或末轮之下。SVG路径只序列化那个元素本身，挂在它旁边的页头会被布局出来，然后丢在字节之外。那里的颜色写字面灰值：`var(--dsw-alias-*)`在实时页面里能解析（手绘读的是活DOM），序列化出来的文档没有主题根，两条路径就会给出不同结果。
- 偏好存放在`localStorage`的一个键`chat-screenshot.options`下，每次读取都归一化：手改过的键、旧版本留下的值、没被提供的外边距，都会在截图看到它之前落到一个被提供的值上。插件不声明Host侧`Config`，截图不应该需要重启才生效。设置区是一处`settings.section`注册：导航文字由宿主画，组件只收到`close`，所以这个区画的是行，不是标题。
- 右键菜单与轮次选择器用宿主自己的组件。`shell/runtime.js`以`native`暴露它们，取自模块系统发给每个包的种子词`@deepseek-ai/dsh-client-ui-primitives`；手写一套会丢掉周围的界面本来有的主题、焦点圈禁与键盘行为。在没有种子的构建里`native`可以是`undefined`，所以每处用法都退化为什么都不画，而不是抛错。
- 一轮由它的开场消息定位，不由回复定位。轮次从`[data-chat-flow-kind="user"]`读出，下一轮开始处就是上一轮结束处，还在流式生成的回复还没有`[data-turn-tail]`，它仍然是一轮，也仍然可以截。多选时保留这些带、丢掉其余，图片里不会留下被跳过轮次的空当。
- 每个部分都要能被node单独导入：顶层声明写`export`（打包时会去掉），用到相邻部分的名称就写`import`，即使合并后的作用域会掩盖漏写。
- JavaScript源码行尾不写分号。`shell/style.js`里的CSS是模板字符串，自带分号，任何批量去分号的处理都必须跳过这个文件。

## 验证

```bash
node build.mjs --check
node checks/structure.mjs
node checks/i18n.mjs
node checks/logic.mjs
node checks/serve.mjs   # 然后打开 http://127.0.0.1:8712/checks/dom.html
```

前四项覆盖打包契约、文案表与纯函数。`checks/dom.html`跑需要文档的那些部分（分页标签、界面部件开关、插入的块以及它们喂给的裁剪），对着一份用宿主标记搭出的fixture，在标签页标题里打印PASS/FAIL，逐条结果在`window.__verify`上。`checks/serve.mjs`存在的原因是浏览器拒绝从`file://`加载模块图。

它们都看不出画面是否正确：要确认这一点，打开页面，点两个相机按钮，把结果粘贴出来看。

`apply`会挂上`window.__chatScreenshot`，插件卸载时删除。它带`captureConversation(anchor)`、`captureTurn(tail)`与`translate(key, vars)`。这个句柄的用途是在没有渲染出操作行的沙箱页面里单独验证某条路径：`captureTurn`接收`[data-turn-tail]`元素，`captureConversation`接收对话滚动容器内的任意元素，两者都返回截图对象，含blob、像素尺寸、缩放倍数与渲染器类型。

重新打包后的产物在组合时确定内容版本，运行中的宿主拿到的仍是旧字节：把插件关掉再打开，然后刷新页面。

English original: [AGENTS.md](AGENTS.md)。
