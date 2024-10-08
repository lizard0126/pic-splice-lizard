import { Context, Schema, h } from 'koishi';
import { } from 'koishi-plugin-puppeteer';

export const name = 'pic-splice-lizard';
export const inject = ['puppeteer'];
export const usage = `
## 拼图插件使用方法：
- 输入指令“拼图 [方向]”，可选方向有横向或纵向，默认纵向
- 发送图片，可以一次发送多张，也可以多次发送
- 请输入“完成”或等待10秒自动拼接 
`;
export interface Config {}

export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context) {
  const logger = ctx.logger('pic-splice-lizard');

  const userImages: Record<string, { direction: string; images: string[]; processing?: boolean }> = {};
  const timeout: Record<string, NodeJS.Timeout> = {};

  // 拼图指令
  ctx.command('拼图 [方向]', '拼接多张图片，默认方向为纵向')
    .action(async ({ session }, direction = '纵向') => {
      if (direction !== '横向' && direction !== '纵向') {
        return '拼接方向只能是 "横向" 或 "纵向"。';
      }

      logger.info(`[拼图] 用户 ${session.userId} 开始拼接图片，方向：${direction}`);

      userImages[session.userId] = {
        direction: direction,
        images: [],
      };

      return '请发送图片。当图片发送完成后，请输入 "完成" 或等待超时自动拼接。';
    });

  // 中间件监听图片消息
  ctx.middleware(async (session, next) => {
    if (!userImages[session.userId]) {
      return next();
    }

    const messageContent = session.content;

    // 提取消息中的图片
    const images = h.select(messageContent, 'img').map(img => img.attrs.src);
    userImages[session.userId].images.push(...images);

    if (images.length > 0) {
      const totalImages = userImages[session.userId].images.length;
      await session.send(`已获取 ${totalImages} 张图片。`);
    }

    if (messageContent.trim() === '完成') {
      await stitchAndSendImages(ctx, session);
      clearTimeout(timeout[session.userId]);
      return;
    }

    // 超时机制：10秒内未继续发送图片，则自动拼接
    clearTimeout(timeout[session.userId]);
    timeout[session.userId] = setTimeout(async () => {
      await stitchAndSendImages(ctx, session);
    }, 10000);
  });

  // 使用 Puppeteer 拼接图片
  async function stitchImages(ctx: Context, imageUrls: string[], direction: string) {
    const html = generateHtmlForImages(imageUrls, direction);
    const maxRetries = 3;
    const retryDelayMs = 1000;
    const renderErrorMsg = '[拼图] 渲染图片时发生错误：';
    const connectionClosedMsg = 'Connection closed';
  
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const page = await ctx.puppeteer.page();
        page.setDefaultTimeout(30000);
        await page.setContent(html);

        // 等待所有图片加载完成
        await page.evaluate(async () => {
          const images = Array.from(document.images);
          await Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => img.onload = resolve);
          }));
        });

        // 截图
        const screenshot = await page.screenshot({ fullPage: true });
        await page.close();
        return screenshot;
      } catch (error) {
        ctx.logger('pic-splice-lizard').error(`${renderErrorMsg}${error.message}`);
  
        if (error.message.includes(connectionClosedMsg)) {
          ctx.logger('pic-splice-lizard').info('[拼图] 连接关闭，正在重试...');
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        } else {
          throw error;
        }
      }
    }
  
    throw new Error('[拼图] 达到最大重试次数，仍无法渲染图片');
  }

  // 生成包含图片的 HTML
  function generateHtmlForImages(imageUrls: string[], direction: string) {
    const style = `
      <style>
        body {
          margin: 0;
          display: flex;
          flex-direction: ${direction === '横向' ? 'row' : 'column'};
        }
        img {
          display: block;
        }
      </style>
    `;
  
    const imagesHtml = imageUrls.map(url => `<img src="${url}">`).join('');
    return `<html><head>${style}</head><body>${imagesHtml}</body></html>`;
  }

  // 拼接图片并发送
  async function stitchAndSendImages(ctx: Context, session: any) {
    const userImageData = userImages[session.userId];

    // 防止重复拼接
    if (!userImageData || userImageData.processing) {
      return;
    }

    userImageData.processing = true;

    const { direction, images } = userImageData;

    if (images.length < 2) {
      await session.send('请提供至少两张图片进行拼接。');
      userImageData.processing = false;
      return;
    }

    try {
      logger.info(`[拼图] 开始拼接图片，方向：${direction}，图片数量：${images.length}`);
      const stitchedImageBuffer = await stitchImages(ctx, images, direction);

      await session.send(h.image(stitchedImageBuffer, 'image/png'));
    } catch (error) {
      logger.error(`[拼图] 拼接图片时发生错误：${error.message}`);
      await session.send('拼接图片时发生错误，请稍后再试。');
    } finally {
      // 清理用户的图片数据
      delete userImages[session.userId];
      delete timeout[session.userId];
    }
  }
}
