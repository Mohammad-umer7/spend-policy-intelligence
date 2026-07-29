import { transactions } from "@/lib/data/transactions";
import { InvestigationClient } from "@/components/investigation/investigation-client";

/** Every synthetic case is prerendered so navigation in the demo is instant. */
export function generateStaticParams() {
  return transactions.map((transaction) => ({ id: transaction.id }));
}

export default async function TransactionPage(props: PageProps<"/transactions/[id]">) {
  const { id } = await props.params;
  return <InvestigationClient transactionId={id} />;
}
