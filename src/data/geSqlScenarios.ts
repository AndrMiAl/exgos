export type SqlSeedRow = Record<string, string | number | Date | null>

export type GeSqlScenario = {
  id: string
  title: string
  description: string
  schema: string[]
  tables: Record<string, SqlSeedRow[]>
}

function date(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

export const geSqlScenarios: Record<string, GeSqlScenario> = {
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
}
