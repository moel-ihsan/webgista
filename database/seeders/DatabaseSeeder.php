<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * @return void
     */
    public function run()
    {
        $adminEmail = env('DEMO_ADMIN_EMAIL', 'admin@webgista.test');
        $adminPassword = env('DEMO_ADMIN_PASSWORD', 'password');

        User::firstOrCreate(
            ['email' => $adminEmail],
            [
                'name' => 'Diskominfotik Kota Banda Aceh',
                'address' => 'Jl. T. Nyak Arief No. 1, Banda Aceh',
                'lattitude' => '5.552874',
                'longitude' => '95.327801',
                'description' => 'Sistem Pemetaan Real-Time Kondisi Lalu Lintas Persimpangan Kota Banda Aceh.',
                'profile_photo_path' => null,
                'role' => 'admin',
                'password' => Hash::make($adminPassword),
            ]
        );

        $this->call([
            MapSettingSeeder::class,
            AgencyListSeeder::class,
            CctvPointSeeder::class,
        ]);
    }
}
