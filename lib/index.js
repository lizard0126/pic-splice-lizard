var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Config: () => Config,
  apply: () => apply,
  inject: () => inject,
  name: () => name,
  usage: () => usage
});
module.exports = __toCommonJS(src_exports);
var import_koishi = require("koishi");
var name = "pic-splice-lizard";
var inject = ["puppeteer"];
var usage = `
## 拼图插件使用方法：
- 输入指令“拼图 [方向]”，可选方向有横向或纵向，默认纵向
- 发送图片，可以一次发送多张，也可以多次发送
- 请输入“完成”或等待10秒自动拼接 
`;
var Config = import_koishi.Schema.object({});
function apply(ctx) {
  const logger = ctx.logger("pic-splice-lizard");
  const userImages = {};
  const timeout = {};
  ctx.command("拼图 [方向]", "拼接多张图片，默认方向为纵向").action(async ({ session }, direction = "纵向") => {
    if (direction !== "横向" && direction !== "纵向") {
      return '拼接方向只能是 "横向" 或 "纵向"。';
    }
    logger.info(`[拼图] 用户 ${session.userId} 开始拼接图片，方向：${direction}`);
    userImages[session.userId] = {
      direction,
      images: []
    };
    return '请发送图片。当图片发送完成后，请输入 "完成" 或等待超时自动拼接。';
  });
  ctx.middleware(async (session, next) => {
    if (!userImages[session.userId]) {
      return next();
    }
    const messageContent = session.content;
    const images = import_koishi.h.select(messageContent, "img").map((img) => img.attrs.src);
    userImages[session.userId].images.push(...images);
    if (images.length > 0) {
      const totalImages = userImages[session.userId].images.length;
      await session.send(`已获取 ${totalImages} 张图片。`);
    }
    if (messageContent.trim() === "完成") {
      await stitchAndSendImages(ctx, session);
      clearTimeout(timeout[session.userId]);
      return;
    }
    clearTimeout(timeout[session.userId]);
    timeout[session.userId] = setTimeout(async () => {
      await stitchAndSendImages(ctx, session);
    }, 1e4);
  });
  async function stitchImages(ctx2, imageUrls, direction) {
    const html = generateHtmlForImages(imageUrls, direction);
    const maxRetries = 3;
    const retryDelayMs = 1e3;
    const renderErrorMsg = "[拼图] 渲染图片时发生错误：";
    const connectionClosedMsg = "Connection closed";
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const page = await ctx2.puppeteer.page();
        page.setDefaultTimeout(3e4);
        await page.setContent(html);
        await page.evaluate(async () => {
          const images = Array.from(document.images);
          await Promise.all(images.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => img.onload = resolve);
          }));
        });
        const screenshot = await page.screenshot({ fullPage: true });
        await page.close();
        return screenshot;
      } catch (error) {
        ctx2.logger("pic-splice-lizard").error(`${renderErrorMsg}${error.message}`);
        if (error.message.includes(connectionClosedMsg)) {
          ctx2.logger("pic-splice-lizard").info("[拼图] 连接关闭，正在重试...");
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        } else {
          throw error;
        }
      }
    }
    throw new Error("[拼图] 达到最大重试次数，仍无法渲染图片");
  }
  __name(stitchImages, "stitchImages");
  function generateHtmlForImages(imageUrls, direction) {
    const style = `
      <style>
        body {
          margin: 0;
          display: flex;
          flex-direction: ${direction === "横向" ? "row" : "column"};
        }
        img {
          display: block;
        }
      </style>
    `;
    const imagesHtml = imageUrls.map((url) => `<img src="${url}">`).join("");
    return `<html><head>${style}</head><body>${imagesHtml}</body></html>`;
  }
  __name(generateHtmlForImages, "generateHtmlForImages");
  async function stitchAndSendImages(ctx2, session) {
    const userImageData = userImages[session.userId];
    if (!userImageData || userImageData.processing) {
      return;
    }
    userImageData.processing = true;
    const { direction, images } = userImageData;
    if (images.length < 2) {
      await session.send("请提供至少两张图片进行拼接。");
      userImageData.processing = false;
      return;
    }
    try {
      logger.info(`[拼图] 开始拼接图片，方向：${direction}，图片数量：${images.length}`);
      const stitchedImageBuffer = await stitchImages(ctx2, images, direction);
      await session.send(import_koishi.h.image(stitchedImageBuffer, "image/png"));
    } catch (error) {
      logger.error(`[拼图] 拼接图片时发生错误：${error.message}`);
      await session.send("拼接图片时发生错误，请稍后再试。");
    } finally {
      delete userImages[session.userId];
      delete timeout[session.userId];
    }
  }
  __name(stitchAndSendImages, "stitchAndSendImages");
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  inject,
  name,
  usage
});
