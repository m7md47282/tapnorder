import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { TablerIconsModule } from 'angular-tabler-icons';

// menu item card
interface productCards {
    id: number;
    imgSrc: string;
    title: string;
    price: string;
    rprice: string;
}

@Component({
    selector: 'app-blog-card',
    imports: [MatCardModule, TablerIconsModule, MatButtonModule],
    templateUrl: './blog-card.component.html',
})
export class AppBlogCardsComponent {
    constructor() { }

    productcards: productCards[] = [
        {
            id: 1,
            imgSrc: '/assets/images/products/s4.jpg',
            title: 'Espresso',
            price: '3.50',
            rprice: '4.00',
        },
        {
            id: 2,
            imgSrc: '/assets/images/products/s5.jpg',
            title: 'Cappuccino',
            price: '4.50',
            rprice: '5.00',
        },
        {
            id: 3,
            imgSrc: '/assets/images/products/s7.jpg',
            title: 'Caesar Salad',
            price: '12.00',
            rprice: '14.00',
        },
        {
            id: 4,
            imgSrc: '/assets/images/products/s11.jpg',
            title: 'Chocolate Cake',
            price: '6.50',
            rprice: '7.50',
        },
    ];
}
