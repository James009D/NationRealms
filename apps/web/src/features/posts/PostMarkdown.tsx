import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { PostContentFormat } from "@statecraft/shared";

export function PostMarkdown({ body, format = "MARKDOWN" }: { body: string; format?: PostContentFormat }) {
  if (format === "PLAIN_TEXT") {
    return (
      <div className="post-body">
        {body.split("\n").map((line, index) => (
          <p key={`${line}-${index}`}>{line || "\u00a0"}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="post-body">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]} remarkPlugins={[remarkGfm]}>
        {body}
      </ReactMarkdown>
    </div>
  );
}
