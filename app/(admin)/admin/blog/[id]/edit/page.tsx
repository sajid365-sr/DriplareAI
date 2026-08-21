import { BlogPostEditor } from "@/components/admin/BlogPostEditor";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminBlogEditPage({ params }: PageProps) {
  const { id } = await params;
  return <BlogPostEditor postId={id} />;
}
