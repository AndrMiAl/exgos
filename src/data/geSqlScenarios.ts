import carmodelDump from '@/content/exam-sql/repa/carmodel_202606111135.sql?raw'
import clientDump from '@/content/exam-sql/repa/client_202606111136.sql?raw'
import manufacturerDump from '@/content/exam-sql/repa/manufacturer_202606111136.sql?raw'
import rentalDump from '@/content/exam-sql/repa/rental_202606111136.sql?raw'
import supplierDump from '@/content/exam-sql/repa/supplier_202606111136.sql?raw'
import vehicleDump from '@/content/exam-sql/repa/vehicle_202606111136.sql?raw'

export type SqlSeedRow = Record<string, string | number | Date | null>

export type GeSqlScenario = {
  id: string
  title: string
  description: string
  schema: string[]
  tables: Record<string, SqlSeedRow[]>
}

export type GeSqlScenarioId = 'giaAirport' | 'examRental'

function date(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

function parseSqlToken(token: string) {
  const trimmed = token.trim()

  if (/^null$/i.test(trimmed)) {
    return null
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    const unquoted = trimmed.slice(1, -1).replace(/''/g, "'")

    if (/^\d{4}-\d{2}-\d{2}$/.test(unquoted)) {
      return date(unquoted)
    }

    return unquoted
  }

  if (/^-?\d+$/.test(trimmed)) {
    return Number(trimmed)
  }

  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return Number(trimmed)
  }

  return trimmed
}

function splitTupleValues(tupleText: string) {
  const values: string[] = []
  let current = ''
  let inString = false

  for (let index = 0; index < tupleText.length; index += 1) {
    const char = tupleText[index]
    const next = tupleText[index + 1]

    if (char === "'" && inString && next === "'") {
      current += "''"
      index += 1
      continue
    }

    if (char === "'") {
      inString = !inString
      current += char
      continue
    }

    if (char === ',' && !inString) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  if (current.trim()) {
    values.push(current.trim())
  }

  return values
}

function extractTuples(valuesBlock: string) {
  const tuples: string[] = []
  let current = ''
  let depth = 0
  let inString = false

  for (let index = 0; index < valuesBlock.length; index += 1) {
    const char = valuesBlock[index]
    const next = valuesBlock[index + 1]

    if (char === "'" && inString && next === "'") {
      current += "''"
      index += 1
      continue
    }

    if (char === "'") {
      inString = !inString
      current += char
      continue
    }

    if (!inString && char === '(') {
      if (depth === 0) {
        current = ''
      } else {
        current += char
      }
      depth += 1
      continue
    }

    if (!inString && char === ')') {
      depth -= 1

      if (depth === 0) {
        tuples.push(current)
        current = ''
      } else {
        current += char
      }
      continue
    }

    if (depth > 0) {
      current += char
    }
  }

  return tuples
}

function parseInsertDump(dump: string) {
  const rows: SqlSeedRow[] = []
  const pattern = /INSERT INTO public\.(\w+)\s*\(([^)]+)\)\s*VALUES\s*([\s\S]*?);/g
  let match: RegExpExecArray | null = pattern.exec(dump)
  let nextId = 1

  while (match) {
    const columns = match[2].split(',').map((column) => column.trim())
    const tuples = extractTuples(match[3])

    for (const tuple of tuples) {
      const values = splitTupleValues(tuple).map(parseSqlToken)
      const row: SqlSeedRow = { id: nextId }

      columns.forEach((column, index) => {
        row[column] = values[index] ?? null
      })

      rows.push(row)
      nextId += 1
    }

    match = pattern.exec(dump)
  }

  return rows
}

const examRentalTables = {
  manufacturer: parseInsertDump(manufacturerDump),
  supplier: parseInsertDump(supplierDump),
  client: parseInsertDump(clientDump),
  carmodel: parseInsertDump(carmodelDump),
  vehicle: parseInsertDump(vehicleDump),
  rental: parseInsertDump(rentalDump),
}

export const geSqlScenarios: Record<GeSqlScenarioId, GeSqlScenario> = {
  giaAirport: {
    id: 'giaAirport',
    title: 'Учебная база авиаперевозок',
    description:
      'Доступны таблицы Company, Trip, Passenger и Pass_in_trip. Префикс `_GIA.dbo.` можно писать или не писать: тренажер его поймет.',
    schema: [
      'Company(Id_comp, id_comp, name)',
      'Trip(trip_no, id_comp, town_from, town_to, plane, time_out)',
      'Passenger(Id_psg, id_psg, name)',
      'Pass_in_trip(trip_no, id_psg, date_trip, place)',
    ],
    tables: {
      Company: [
        { Id_comp: 1, id_comp: 1, name: 'Aurora Air' },
        { Id_comp: 2, id_comp: 2, name: 'Polar Wings' },
        { Id_comp: 3, id_comp: 3, name: 'Metro Jet' },
      ],
      Trip: [
        { trip_no: 100, id_comp: 1, town_from: 'Moscow', town_to: 'Kazan', plane: 'SU9', time_out: '08:00' },
        { trip_no: 101, id_comp: 1, town_from: 'Kazan', town_to: 'Moscow', plane: 'SU9', time_out: '18:00' },
        { trip_no: 200, id_comp: 2, town_from: 'Moscow', town_to: 'Sochi', plane: 'B737', time_out: '09:30' },
        { trip_no: 201, id_comp: 2, town_from: 'Sochi', town_to: 'Moscow', plane: 'B737', time_out: '20:15' },
        { trip_no: 300, id_comp: 3, town_from: 'Moscow', town_to: 'SPB', plane: 'A320', time_out: '07:45' },
        { trip_no: 301, id_comp: 3, town_from: 'SPB', town_to: 'Moscow', plane: 'A320', time_out: '21:00' },
        {
          trip_no: 400,
          id_comp: 1,
          town_from: 'Moscow',
          town_to: 'Ekaterinburg',
          plane: 'SSJ100',
          time_out: '11:10',
        },
      ],
      Passenger: [
        { Id_psg: 1, id_psg: 1, name: 'Anna' },
        { Id_psg: 2, id_psg: 2, name: 'Boris' },
        { Id_psg: 3, id_psg: 3, name: 'Daria' },
        { Id_psg: 4, id_psg: 4, name: 'Egor' },
        { Id_psg: 5, id_psg: 5, name: 'Inna' },
        { Id_psg: 6, id_psg: 6, name: 'Rita' },
      ],
      Pass_in_trip: [
        { trip_no: 100, id_psg: 1, date_trip: date('2025-04-02'), place: '12a' },
        { trip_no: 100, id_psg: 2, date_trip: date('2025-04-02'), place: '14c' },
        { trip_no: 100, id_psg: 3, date_trip: date('2025-04-02'), place: '15d' },
        { trip_no: 100, id_psg: 1, date_trip: date('2025-04-04'), place: '10a' },
        { trip_no: 101, id_psg: 1, date_trip: date('2025-04-05'), place: '09d' },
        { trip_no: 101, id_psg: 4, date_trip: date('2025-04-05'), place: '11b' },
        { trip_no: 200, id_psg: 2, date_trip: date('2025-04-10'), place: '07a' },
        { trip_no: 200, id_psg: 5, date_trip: date('2025-04-10'), place: '07d' },
        { trip_no: 200, id_psg: 6, date_trip: date('2025-05-01'), place: '08a' },
        { trip_no: 201, id_psg: 3, date_trip: date('2025-04-11'), place: '01c' },
        { trip_no: 201, id_psg: 5, date_trip: date('2025-04-11'), place: '02d' },
        { trip_no: 300, id_psg: 4, date_trip: date('2025-04-12'), place: '03a' },
        { trip_no: 300, id_psg: 6, date_trip: date('2025-04-12'), place: '03b' },
        { trip_no: 301, id_psg: 2, date_trip: date('2024-04-12'), place: '04a' },
        { trip_no: 400, id_psg: 3, date_trip: date('2025-04-13'), place: '05d' },
        { trip_no: 400, id_psg: 4, date_trip: date('2025-04-13'), place: '06f' },
      ],
    },
  },
  examRental: {
    id: 'examRental',
    title: 'Учебная база проката автомобилей',
    description:
      'Доступны таблицы client, rental, vehicle, carmodel, manufacturer и supplier. Данные собраны из SQL-дампов для госов.',
    schema: [
      'client(id, last_name, first_name, middle_name, license_num, birth_date, reg_date)',
      'rental(id, id_vehicle, id_client, start_date, end_date, fact_return)',
      'vehicle(id, id_carmodel, vin_number, plate_number, mileage, garage_slot)',
      'carmodel(id, model_name, id_manufacturer, id_supplier, year_from, engine_type, seats_count)',
      'manufacturer(id, name, country, founded_year)',
      'supplier(id, name, city, phone)',
    ],
    tables: examRentalTables,
  },
}
