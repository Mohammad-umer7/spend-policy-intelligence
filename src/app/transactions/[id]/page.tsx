import { transactions } from "@/lib/data/transactions";
import { InvestigationClient } from "@/components/investigation/investigation-client";

/** Every case is prerendered so navigation is instant. */
export function generateStaticParams() {
  return transactions.map((transaction) => ({ id: transaction.id }));
}

export default async function TransactionPage(props: PageProps<"/transactions/[id]">) {
  const { id } = await props.params;
  return <InvestigationClient transactionId={id} />;
}
