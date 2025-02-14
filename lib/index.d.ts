import { Context, Schema } from 'koishi';
export declare const name = "pic-splice-lizard";
export declare const inject: string[];
export declare const usage = "\n## \u62FC\u56FE\u63D2\u4EF6\u4F7F\u7528\u65B9\u6CD5\uFF1A\n- \u8F93\u5165\u6307\u4EE4\u201C\u62FC\u56FE [\u65B9\u5411]\u201D\uFF0C\u53EF\u9009\u65B9\u5411\u6709\u6A2A\u5411\u6216\u7EB5\u5411\uFF0C\u9ED8\u8BA4\u7EB5\u5411\n- \u53D1\u9001\u56FE\u7247\uFF0C\u53EF\u4EE5\u4E00\u6B21\u53D1\u9001\u591A\u5F20\uFF0C\u4E5F\u53EF\u4EE5\u591A\u6B21\u53D1\u9001\n- \u8BF7\u8F93\u5165\u201C\u5B8C\u6210\u201D\u6216\u7B49\u5F8510\u79D2\u81EA\u52A8\u62FC\u63A5 \n";
export interface Config {
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context): void;
