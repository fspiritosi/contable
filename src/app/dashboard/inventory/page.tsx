import { getProducts } from "@/actions/products";
import { getAccounts } from "@/actions/accounts";
import { getActiveOrganizationId } from "@/lib/organization";
import ProductManager from "./product-manager";

export default async function InventoryPage() {
    const currentOrgId = await getActiveOrganizationId();
    const { data: products } = await getProducts(currentOrgId);
    const { data: accounts } = await getAccounts();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Inventario</h2>
                    <p className="text-gray-500">Gestiona tus productos y servicios.</p>
                </div>
            </div>

            <ProductManager
                initialProducts={products || []}
                organizationId={currentOrgId}
                accounts={accounts || []}
            />
        </div>
    );
}
