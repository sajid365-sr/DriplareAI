export async function exchangeMetaBusinessLoginCode(chatbotId: string, code: string): Promise<string> {
  const response = await fetch(
    `/api/chatbots/${encodeURIComponent(chatbotId)}/integrations/meta/business-login/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }
  );
  const data = await response.json();

  if (!response.ok || typeof data?.accessToken !== "string") {
    throw new Error(data?.error || "Failed to complete Facebook Login for Business.");
  }

  return data.accessToken;
}
