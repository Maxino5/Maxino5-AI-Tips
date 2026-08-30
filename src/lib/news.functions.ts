import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getNews = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ category: z.enum(["all", "football"]) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { loadNews } = await import("./news.server");
    return loadNews(data.category);
  });
