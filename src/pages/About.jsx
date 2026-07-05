import { Navigate, useSearchParams } from "react-router-dom";

export default function About() {
  const [searchParams] = useSearchParams();
  const query = searchParams.toString();
  return <Navigate to={query ? `/faq?${query}` : "/faq"} replace />;
}