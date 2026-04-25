export async function parseApiResponse(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();

  if (!body) {
    return {};
  }

  if (!contentType.includes('application/json')) {
    throw new Error(
      `${fallbackMessage} The server returned ${contentType || 'a non-JSON response'} from ${response.url}.`
    );
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(`${fallbackMessage} The server response could not be parsed as JSON.`);
  }
}
