// Display metadata from hatchery.vaccines, verified 2026-10-11.
// Keep source identities unchanged; vaccine technology differs from report administration category.
// Innovax: https://egypt.msd-animal-health.com/products/innovax-nd-ibd/
// Trovac: https://animalhealth.boehringer-ingelheim.com/poultry/all-poultry-vaccines
// Nextmune: https://poultry.ceva.com/poultry-vaccines/nextmune/
// Newflend: https://poultry.ceva.com/poultry-vaccines/newflend/
export const PRODUCT_TYPE_ORDER = ['Recombinant vaccine', 'Marek', 'Live', 'Killed', 'Antibiotic', 'Immune complex', 'Other'];
const catalog = new Map([
  {
    "id": "67343546-71e3-434d-8d81-28275aad02fe",
    "name": "Amikacin",
    "type": "Antibiotic"
  },
  {
    "id": "457ad57c-fbd8-4c1a-b142-55f1c74cf15a",
    "name": "Cephotax",
    "type": "Antibiotic"
  },
  {
    "id": "6fa7b84e-5baa-49b3-8b71-ea6971df2f14",
    "name": "Excenel",
    "type": "Antibiotic"
  },
  {
    "id": "83e57455-d910-47f2-826b-d33764335fba",
    "name": "Gentamycin",
    "type": "Antibiotic"
  },
  {
    "id": "d3ce71d1-ba77-4ae6-844c-d3ebe5a5a430",
    "name": "Kenafur",
    "type": "Antibiotic"
  },
  {
    "id": "731ecd63-f287-4aa3-9011-c042f971b6e5",
    "name": "Linco-Spectine",
    "type": "Antibiotic"
  },
  {
    "id": "4be6f5d6-eafc-4217-8ebe-ce68b10f9016",
    "name": "Procerta IBD",
    "type": "Recombinant vaccine"
  },
  {
    "id": "105daca8-5141-4111-8b8f-21f5c6df9042",
    "name": "Procerta IBD ND",
    "type": "Recombinant vaccine"
  },
  {
    "id": "afbcb970-4380-4273-a98e-1e452b119222",
    "name": "Procerta ND",
    "type": "Recombinant vaccine"
  },
  {
    "id": "5fb161d3-e3d5-4b0f-95fb-9cbb86477347",
    "name": "Vaxxitek IBD",
    "type": "Recombinant vaccine"
  },
  {
    "id": "cae8c24d-bfcb-4b98-9759-5d189e11d337",
    "name": "BursaPlex",
    "type": "Immune complex"
  },
  {
    "id": "1041b1bc-bb7e-40cd-ab6d-2b130b9e35cb",
    "name": "Gumbo Hatch",
    "type": "Immune complex"
  },
  {
    "id": "77550959-89d7-4ef1-8f10-abca0e68ef8b",
    "name": "PNK",
    "type": "Immune complex"
  },
  {
    "id": "dea0bfff-b93a-4854-97a6-6ae3f30879f1",
    "name": "Transmune",
    "type": "Immune complex"
  },
  {
    "id": "92531b69-a7dc-4947-b527-8b68a0d0b035",
    "name": "Cevac Flu H9K",
    "type": "Killed"
  },
  {
    "id": "f029579c-dfed-40e4-a618-52afc36c931a",
    "name": "EgyEuro H9ND",
    "type": "Killed"
  },
  {
    "id": "b0627984-dc4d-4043-bae8-7d6af133c4cc",
    "name": "Egymune ND H9",
    "type": "Killed"
  },
  {
    "id": "0945e3ef-56ae-45c4-96c6-392319e97348",
    "name": "Five stars ND",
    "type": "Killed"
  },
  {
    "id": "01248320-84f8-4b89-b4c9-027785d0a132",
    "name": "Five stars ND H9",
    "type": "Killed"
  },
  {
    "id": "3b3693ae-c711-4bf0-a7ba-8909cf70f635",
    "name": "Gallimune H9",
    "type": "Killed"
  },
  {
    "id": "21494525-ddd6-41dd-9d7f-02fc6b54f717",
    "name": "Global ND7",
    "type": "Killed"
  },
  {
    "id": "cad023a0-ea94-44b8-a41c-60b77e969036",
    "name": "killed H9",
    "type": "Killed"
  },
  {
    "id": "980c4df7-87e8-4a37-8494-2f4a36004b4f",
    "name": "killed vaccine",
    "type": "Killed"
  },
  {
    "id": "4a648569-1df5-4bbe-a97b-6458b5675caa",
    "name": "Mayflovac H5 H9 ND",
    "type": "Killed"
  },
  {
    "id": "9287a103-dc2d-494b-ab42-448c38c7a013",
    "name": "Mevac H9",
    "type": "Killed"
  },
  {
    "id": "3e44f585-0484-48b4-b776-d6c256c2d2a0",
    "name": "Mevac ND H9",
    "type": "Killed"
  },
  {
    "id": "888ea0a3-5f3c-49c2-b25b-7920f84aa406",
    "name": "ND7ZT",
    "type": "Killed"
  },
  {
    "id": "fbdd9730-64d3-4eee-9686-738d65c6d1b7",
    "name": "PAMP",
    "type": "Killed"
  },
  {
    "id": "910e6e50-2704-4bad-be6c-ce4825654a2f",
    "name": "Sinder ND H9",
    "type": "Killed"
  },
  {
    "id": "c4fc9b0d-14cb-4809-961a-a3a741d18680",
    "name": "V.Valley Exceed H9 ND",
    "type": "Killed"
  },
  {
    "id": "86b535e4-eb95-4dc7-a527-31d95b5795d4",
    "name": "Newflend",
    "type": "Recombinant vaccine"
  },
  {
    "id": "801e45da-6f95-4949-9451-a75b0f6e1e2c",
    "name": "4/91",
    "type": "Live"
  },
  {
    "id": "c3fdcc8e-f29b-4780-83d6-af3e2ef1a3af",
    "name": "Avinew",
    "type": "Live"
  },
  {
    "id": "16e84c1c-aea1-4456-9af3-cb97afb92f77",
    "name": "Avishield",
    "type": "Live"
  },
  {
    "id": "bba08050-4b20-42c3-b573-891409fe4813",
    "name": "Bioral h120",
    "type": "Live"
  },
  {
    "id": "8cdbc1f8-2b95-49de-8bb9-342168d9c6f9",
    "name": "Bursin 2",
    "type": "Live"
  },
  {
    "id": "d87d1dd1-fe50-4a22-8625-091c52271b7e",
    "name": "Clone jilvac",
    "type": "Live"
  },
  {
    "id": "90f5b0ae-b91e-42fd-9ef3-2b91cd9f1119",
    "name": "Clone Ma5",
    "type": "Live"
  },
  {
    "id": "d1ce11c6-0eb9-433a-82e7-f62cc05889e4",
    "name": "CR88",
    "type": "Live"
  },
  {
    "id": "6bef5637-2dac-410a-9b41-dd5f681d3275",
    "name": "Egyvac Clone 124",
    "type": "Live"
  },
  {
    "id": "c5c20035-fff2-42ba-b304-4e9fdf0bb591",
    "name": "Egyvac IB Multi",
    "type": "Live"
  },
  {
    "id": "f0f3526c-508c-4e45-9247-cec75ebd9311",
    "name": "Galivac IB88",
    "type": "Live"
  },
  {
    "id": "af9dcedc-c482-40b8-835c-943f85213402",
    "name": "Himmvac IBD",
    "type": "Live"
  },
  {
    "id": "4f09f85c-8e63-44a3-810a-cc2bc2a7a6c5",
    "name": "Hitchner ib",
    "type": "Live"
  },
  {
    "id": "2c48d790-0812-4064-a6b8-c3bc82b1b400",
    "name": "IB Primer",
    "type": "Live"
  },
  {
    "id": "cc874833-9d14-443c-9103-c150c944c28b",
    "name": "IBG IB",
    "type": "Live"
  },
  {
    "id": "17c418b7-5950-44c4-b18f-ea09ed3ac33a",
    "name": "Ibird",
    "type": "Live"
  },
  {
    "id": "5e67094c-3585-4f4b-84d7-c56b8a66bd8b",
    "name": "KBNP H B1",
    "type": "Live"
  },
  {
    "id": "05fe3f57-a992-4ab5-a291-107812b9ff9d",
    "name": "Medivac ND IB",
    "type": "Live"
  },
  {
    "id": "a4c937be-b783-41ab-b571-74a0280f14cf",
    "name": "Mevac H1 IB",
    "type": "Live"
  },
  {
    "id": "085ef21c-c4df-43f1-bd87-f7fcc2ed42c7",
    "name": "Mevac IB var 2",
    "type": "Live"
  },
  {
    "id": "90a85a8a-e48e-4ced-ac69-f91f6410b211",
    "name": "Ornimix Clone B1/H120",
    "type": "Live"
  },
  {
    "id": "f2b9ac0f-7bfd-4d15-a63b-dfb20b9489fc",
    "name": "Sinder IB H120",
    "type": "Live"
  },
  {
    "id": "7d6bbe80-bb12-4cd2-91ba-8afe35fdfec3",
    "name": "Ulster IB",
    "type": "Live"
  },
  {
    "id": "6d8da3ad-05fe-4819-8997-e4ef638506d3",
    "name": "V4",
    "type": "Live"
  },
  {
    "id": "e886e108-8418-4e5e-833b-c524c549b28a",
    "name": "Vaksimune ND IB",
    "type": "Live"
  },
  {
    "id": "fac414bf-cb30-40a4-a7d7-89deb739185b",
    "name": "Vitabron",
    "type": "Live"
  },
  {
    "id": "bb5ef05c-c836-4d69-a70f-e8fab060db30",
    "name": "Innovax",
    "type": "Recombinant vaccine"
  },
  {
    "id": "fe260b23-d223-40b4-93e2-af703ca66752",
    "name": "Bio MD Vac",
    "type": "Marek"
  },
  {
    "id": "71d669ff-31d5-44c7-8e6f-83ede9e8851d",
    "name": "Cevac Rispens",
    "type": "Marek"
  },
  {
    "id": "0e0e796a-0582-493e-b02d-f2fd0cb8fd07",
    "name": "OVO line",
    "type": "Marek"
  },
  {
    "id": "32b36b29-550d-4bd3-b579-50c72ccc3538",
    "name": "Prevexion",
    "type": "Marek"
  },
  {
    "id": "6939f5b5-af44-471f-ad45-a84f0e8e063f",
    "name": "Rismavac",
    "type": "Marek"
  },
  {
    "id": "8e524dfd-85c3-41dc-9303-9d78978d17c7",
    "name": "Rispens",
    "type": "Marek"
  },
  {
    "id": "ac08049f-8d25-4f97-ad1e-cb851848115b",
    "name": "Innovax",
    "type": "Recombinant vaccine"
  },
  {
    "id": "e5a7c2df-2a49-497a-977f-40403cc697f3",
    "name": "Trovac",
    "type": "Recombinant vaccine"
  },
  {
    "id": "6134be55-23f6-4606-8cfc-662fc70a8e74",
    "name": "Vaxxitek COBRA",
    "type": "Recombinant vaccine"
  },
  {
    "id": "42c69074-b10e-4a6f-9087-96eedfb499da",
    "name": "Nextmune",
    "type": "Immune complex"
  }
].map(product => [product.id, product]));
const englishNames = {"إينوفاكس":"Innovax","تروفاك":"Trovac","كوبرا":"Vaxxitek COBRA","نيكستيميون":"Nextmune","نيوفلند سيفا":"Newflend"};
export function productDisplay(product) {
  const metadata = catalog.get(product.id);
  return { ...product, name: metadata?.name || englishNames[product.name] || product.name, type: metadata?.type || 'Other' };
}

