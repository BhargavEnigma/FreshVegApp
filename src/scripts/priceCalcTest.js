"use strict";

const { calculatePackPricesFromProduct } = require("../services/pricing.service");

function run(name, product, pack) {
    try {
        const out = calculatePackPricesFromProduct({ product, pack });
        console.log(`\n[PASS] ${name}`);
        console.log({ product, pack, out });
    } catch (e) {
        console.log(`\n[FAIL] ${name}`);
        console.log({ code: e.code, message: e.message, httpStatus: e.httpStatus });
    }
}

// 1) kg -> g
run(
    "Tomato 1kg -> 500g",
    { unit: "kg", base_quantity: 1, mrp_paise: 4000, selling_price_paise: 3000 },
    { base_unit: "g", base_quantity: 500 }
);

// 2) g -> kg
run(
    "Almonds 250g -> 1kg",
    { unit: "g", base_quantity: 250, mrp_paise: 5000, selling_price_paise: 4500 },
    { base_unit: "kg", base_quantity: 1 }
);

// 3) pc -> pc
run(
    "Coconut 1pc -> 3pc",
    { unit: "pc", base_quantity: 1, mrp_paise: 6000, selling_price_paise: 5000 },
    { base_unit: "pc", base_quantity: 3 }
);

// 4) invalid conversion pc -> g
run(
    "Invalid: pc -> g",
    { unit: "pc", base_quantity: 1, mrp_paise: 1000, selling_price_paise: 900 },
    { base_unit: "g", base_quantity: 500 }
);

// 5) base_quantity edge case
run(
    "Invalid: base_quantity=0",
    { unit: "kg", base_quantity: 0, mrp_paise: 1000, selling_price_paise: 900 },
    { base_unit: "g", base_quantity: 500 }
);
