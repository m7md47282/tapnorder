import { Component } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { MaterialModule } from 'src/app/material.module';


interface stats {
    id: number;
    time: string;
    color: string;
    title?: string;
    subtext?: string;
    link?: string;
}

@Component({
    selector: 'app-recent-transactions',
    imports: [NgApexchartsModule, MaterialModule],
    templateUrl: './recent-transactions.component.html',
})
export class AppRecentTransactionsComponent {
    stats: stats[] = [
        {
            id: 1,
            time: '09.30 am',
            color: 'primary',
            subtext: 'Order payment received from Table 5 - $45.90',
        },
        {
            id: 2,
            time: '10.30 am',
            color: 'accent',
            title: 'New order recorded',
            link: '#ORD-3467',
        },
        {
            id: 3,
            time: '12.30 pm',
            color: 'success',
            subtext: 'Table 3 order completed - $64.95',
        },
        {
            id: 4,
            time: '12.30 pm',
            color: 'warning',
            title: 'New order recorded',
            link: '#ORD-3468',
        },
        {
            id: 5,
            time: '12.30 pm',
            color: 'error',
            title: 'New reservation recorded',
            link: '#RES-3467',
        },
        {
            id: 6,
            time: '12.30 pm',
            color: 'success',
            subtext: 'Order Payment Completed',
        },
    ];
}
