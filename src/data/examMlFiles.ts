export type ExamMlFileMeta = {
  name: string
  publicUrl: string
  sizeBytes: number
  rowCount: number
  columns: string[]
  previewRows: string[][]
}

export const examMlFileCatalog: ExamMlFileMeta[] = [
  {
    name: 'customer_churn_classification.csv',
    publicUrl: '/ml-files/customer_churn_classification.csv',
    sizeBytes: 315516,
    rowCount: 2000,
    columns: [
      'tenure',
      'monthly_charges',
      'total_charges',
      'num_contacts',
      'service_calls',
      'payment_delay',
      'contract_type',
      'family_members',
      'churn',
    ],
    previewRows: [
      [
        '-1.399670775271612',
        '-0.22012539121165586',
        '-1.6359344398464368',
        '-0.006000508383008807',
        '-1.406480163337583',
        '-0.31493120445677236',
        '0.2567099615696521',
        '1.0892107429149362',
        '1',
      ],
      [
        '-0.46838349086526904',
        '-0.7195669249005929',
        '-0.4301165838864057',
        '-3.409354787717325',
        '1.5845166996605013',
        '-2.3850203590589425',
        '1.2638585363355421',
        '-2.3239014026734512',
        '0',
      ],
    ],
  },
  {
    name: 'customer_segmentation.csv',
    publicUrl: '/ml-files/customer_segmentation.csv',
    sizeBytes: 14070,
    rowCount: 1000,
    columns: ['income', 'spending_score', 'age', 'freq_purchase'],
    previewRows: [
      ['48516', '39', '23', '1'],
      ['69037', '53', '18', '8'],
    ],
  },
  {
    name: 'electricity_anomalies.csv',
    publicUrl: '/ml-files/electricity_anomalies.csv',
    sizeBytes: 82694,
    rowCount: 2000,
    columns: ['temp', 'weekday_impact', 'actual_consumption'],
    previewRows: [
      ['32.648602922600816', '1.0', '19.970832520253275'],
      ['-4.206584704007039', '0.8', '-13.607033341686572'],
    ],
  },
  {
    name: 'employee_attrition.csv',
    publicUrl: '/ml-files/employee_attrition.csv',
    sizeBytes: 165407,
    rowCount: 1200,
    columns: [
      'satisfaction',
      'performance',
      'years_at_company',
      'overtime',
      'distance_from_home',
      'num_projects',
      'monthly_income',
      'attrition',
    ],
    previewRows: [
      [
        '-0.24070580278382503',
        '-0.07520332107744382',
        '-0.02697055975832785',
        '0.4158094747199904',
        '0.24506444054404986',
        '-0.9033414668207936',
        '0.7961950555235322',
        '0',
      ],
      [
        '2.3918460307427853',
        '1.4568607415522912',
        '0.20500513760463845',
        '-2.6102920858015235',
        '0.19538342675620957',
        '0.4492829228917805',
        '1.0335474942865',
        '1',
      ],
    ],
  },
  {
    name: 'full_employee_data.csv',
    publicUrl: '/ml-files/full_employee_data.csv',
    sizeBytes: 48095,
    rowCount: 800,
    columns: ['salary', 'experience', 'education_level', 'age', 'performance_score'],
    previewRows: [
      ['35476.41284374634', '27.374551626911057', '3', '38', '3.5685165874570415'],
      ['103932.92109957908', '7.979221939623363', '3', '59', '1.1231462754429864'],
    ],
  },
  {
    name: 'house_price_regression.csv',
    publicUrl: '/ml-files/house_price_regression.csv',
    sizeBytes: 174830,
    rowCount: 1500,
    columns: ['sqft', 'bedrooms', 'bathrooms', 'age', 'distance_to_center', 'price'],
    previewRows: [
      ['0.07660907045165961', '0.008783654898147817', '-0.2376833169609843', '1.598321807641033', '0.7335478135058658', '100147.68821999278'],
      ['-1.3011092663913453', '-0.4598592623151402', '-0.4296349785275087', '0.48060859334734735', '1.4465632912513675', '99923.75913770343'],
    ],
  },
  {
    name: 'market_basket.csv',
    publicUrl: '/ml-files/market_basket.csv',
    sizeBytes: 26264,
    rowCount: 1000,
    columns: ['items'],
    previewRows: [
      ['cheese, eggs, banana, bread'],
      ['banana, eggs, apple, bread, cheese'],
    ],
  },
  {
    name: 'product_reviews.csv',
    publicUrl: '/ml-files/product_reviews.csv',
    sizeBytes: 9814,
    rowCount: 500,
    columns: ['review_text', 'rating'],
    previewRows: [
      ['excellent would buy again', '3'],
      ['great product very happy', '3'],
    ],
  },
  {
    name: 'sales_data.csv',
    publicUrl: '/ml-files/sales_data.csv',
    sizeBytes: 16150,
    rowCount: 731,
    columns: ['date', 'revenue', 'product_category', 'units_sold'],
    previewRows: [
      ['2023-01-01', '1196.0', 'D', '29'],
      ['2023-01-02', '', 'B', '33'],
    ],
  },
  {
    name: 'stock_time_series.csv',
    publicUrl: '/ml-files/stock_time_series.csv',
    sizeBytes: 32097,
    rowCount: 1096,
    columns: ['date', 'close_price'],
    previewRows: [
      ['2022-01-01', '100.49671415301123'],
      ['2022-01-02', '100.35844985184005'],
    ],
  },
]

export const examMlFilesByName = Object.fromEntries(examMlFileCatalog.map((file) => [file.name, file])) as Record<
  string,
  ExamMlFileMeta
>
