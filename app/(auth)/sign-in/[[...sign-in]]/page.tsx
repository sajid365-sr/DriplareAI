import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" forceRedirectUrl="/app/chatbots" />
    </div>
  );
}
