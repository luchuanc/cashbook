import prisma from "~~/server/lib/prisma";

export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);
  const body = await readBody(event);
  const { bookId } = body;

  if (!bookId) {
    return error("账本ID不能为空");
  }

  const book = await prisma.book.findFirst({
    where: { 
      bookId,
      userId
    }
  });

  if (!book) {
    return error("账本不存在或无权访问");
  }

  return success({
    flowType: book.defaultFlowType || "",
    attribution: book.defaultAttribution || "",
    payType: book.defaultPayType || ""
  });
});
