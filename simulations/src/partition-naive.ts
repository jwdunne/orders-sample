import { Order, orders } from '@orders-sample/order-service/src/handlers/api';
import { v7 as uuidv7 } from 'uuid';

async function main() {
    let customerIds = [
        uuidv7(),
        uuidv7(),
        uuidv7(),
        uuidv7(),
        uuidv7(),
    ];


    console.time('Creating orders');
    const ordersLists: Order[][] = await Promise.all(customerIds.map(async customerId => {
        let ordersList: Order[] = [];
        let batch = [];

        for (let i = 0; i < 2000; i++) {
            const order = {
                orderId: uuidv7(),
                customerId: customerId,
                status: 'PENDING',
                items: [
                    { product: 'John Doe', price: 20.00, quantity: 2 }
                ],
                total: 20.00,
                createdAt: String(new Date())
            };

            ordersList.push(order);
            batch.push(order);

            if (batch.length >= 25) {
                await orders.batchCreate(batch);
                batch = [];
            }
        }

        if (batch.length > 0) {
            await orders.batchCreate(batch);
            batch = [];
        }

        return ordersList;
    }));
    console.timeEnd('Creating orders');

    let totalUnits = 0;
    console.time('listByCustomer');
    for (let i = 0; i < 100; i++) {
        const { consumedCapacity } = await orders.listByCustomer(customerIds[0]);
        totalUnits += consumedCapacity.total;
    }
    console.log(`Total RCUs: ${totalUnits}; Avg RCUs: ${totalUnits / 100}`);
    console.timeEnd('listByCustomer');

    totalUnits = 0;
    console.time('get');
    for (let i = 0; i < 100; i++) {
        const { orderId, customerId } = ordersLists[0][i];
        const { consumedCapacity } = await orders.get(customerId, orderId);
        totalUnits += consumedCapacity.total;
    }
    console.log(`Total RCUs: ${totalUnits}; Avg RCUs: ${totalUnits / 100}`);
    console.timeEnd('get');
}

main().then(() => process.exit(0));

