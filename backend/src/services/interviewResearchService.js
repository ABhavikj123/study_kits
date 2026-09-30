export async function findInterviewDiscussion(company, signal) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${company} interview process`)}`;
    const response = await fetch(url, {
      signal,
      headers: { 'user-agent': 'InterviewPrepKit/1.0' }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const matches = [...html.matchAll(/result__a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)]
      .slice(0, 3)
      .map((match) => ({
        url: match[1],
        title: match[2].replace(/<[^>]+>/g, '').trim()
      }));

    return { sources: matches, error: null };
  } catch (error) {
    return { sources: [], error: error.message };
  }
}