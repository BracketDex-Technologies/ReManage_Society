export default function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-4 h-4 border-[1.5px]",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-2",
  };

  return (
    <div className="flex items-center justify-center p-6">
      <div className={`spinner ${sizeClasses[size]}`} />
    </div>
  );
}
