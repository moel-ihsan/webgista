<?php

namespace Database\Seeders;

use App\Models\AgencyList;
use Illuminate\Database\Seeder;

class AgencyListSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        foreach (['Dishub', 'Diskominfotik'] as $agency) {
            AgencyList::firstOrCreate(['agency' => $agency]);
        }
    }
}
