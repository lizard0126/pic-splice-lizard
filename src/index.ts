import { Context, Schema, h, Session } from 'koishi';
import { } from 'koishi-plugin-puppeteer';

export const name = 'pic-splice-lizard';
export const inject = ['puppeteer'];
export const usage = `
## 拼图插件使用方法：
- 输入“拼图 [方向]”（横向/纵向，默认纵向）
- 发送多张图片
- 请输入“完成”或等待10秒自动拼接

### 注意事项
- 发送图片后，请输入“完成”以开始拼接。
- 如果未输入“完成”，插件将在10秒后自动拼接。
- 支持一次性发送多张图片，但建议不要超过10张，以免拼接时间过长。

<details>
<summary><strong><span style="font-size: 1.3em; color: #2a2a2a;">如果要反馈建议或报告问题</span></strong></summary>

<strong>可以[点这里](https://github.com/lizard0126/pic-splice-lizard/issues)创建议题~</strong>
</details>

<details>
<summary><strong><span style="font-size: 1.3em; color: #2a2a2a;">如果喜欢我的插件</span></strong></summary>

<strong>可以[请我喝可乐](https://ifdian.net/a/lizard0126)，没准就有动力更新新功能了~</strong>
</details>
`;

export interface Config { }
export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context) {
  const tasks = new Map<string, { dir: '横向' | '纵向'; imgs: string[]; processing: boolean }>();
  const timers = new Map<string, NodeJS.Timeout>();

  function cleanup(userId: string) {
    tasks.delete(userId);
    clearTimeout(timers.get(userId));
    timers.delete(userId);
  }
 
  ctx.command('拼图 [方向]', '拼接多张图片')
    .action(({ session }, dir = '纵向') => {
      if (!['横向', '纵向'].includes(dir)) return '方向只能是 "横向" 或 "纵向"。';
      tasks.set(session.userId, { dir: dir as '横向' | '纵向', imgs: [], processing: false });
      return '请发送图片，输入 "完成" 开始拼接。';
    });

  ctx.middleware(async (session, next) => {
    const task = tasks.get(session.userId);
    if (!task) return next();

    const images = h.select(session.content, 'img').map(img => img.attrs.src);
    task.imgs.push(...images);
    if (images.length) await session.send(`已获取 ${task.imgs.length} 张图片。`);
    if (session.content.trim() === '完成') return processTask(session);

    resetTimeout(session.userId, session);
  });

  function resetTimeout(userId: string, session: Session) {
    clearTimeout(timers.get(userId));
    timers.set(userId, setTimeout(() => processTask(session), 10000));
  }

  async function processTask(session: Session) {
    const task = tasks.get(session.userId);
    if (!task || task.processing || task.imgs.length < 2) {
      return session.send(task?.imgs.length < 2 ? '请提供至少两张图片。' : '任务正在处理中，请稍候。');
    }

    task.processing = true;
    try {
      const imgBuffer = await stitchImages(ctx, task.imgs, task.dir);
      await session.send(h.image(imgBuffer, 'image/png'));
    } catch {
      await session.send('拼接失败，请稍后重试。');
    } finally {
      cleanup(session.userId);
    }
  }

  async function stitchImages(ctx: Context, imgs: string[], dir: '横向' | '纵向') {
    const html = `
      <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: ${dir === '横向' ? 'row' : 'column'};
            align-items: flex-start;
            justify-content: flex-start;
          }
          img {
            display: block;
            width: ${dir === '纵向' ? '100%' : 'auto'};
            height: ${dir === '横向' ? '100%' : 'auto'};
          }
        </style>
      </head>
      <body>
        ${imgs.map(url => `<img src="${url}">`).join('')}
      </body>
      </html>
    `;

    for (let i = 0; i < 3; i++) {
      try {
        const page = await ctx.puppeteer.page();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const { width, height } = await page.evaluate(() => {
          const body = document.body;
          return {
            width: body.scrollWidth,
            height: body.scrollHeight,
          };
        });

        await page.setViewport({ width, height });

        const screenshot = await page.screenshot({
          clip: { x: 0, y: 0, width, height },
        });

        await page.close();
        return screenshot;
      } catch (e) {
        if (e.message.includes('Connection closed')) await new Promise(r => setTimeout(r, 1000));
        else throw e;
      }
    }
    throw new Error('拼接失败');
  }
}