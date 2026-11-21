<?php

namespace Database\Seeders;

use App\Models\CctvPoint;
use Illuminate\Database\Seeder;

class CctvPointSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $pdamSim = config('simulation.cameras.simpang-pdam', []);
        $jamboSim = config('simulation.cameras.simpang-jambo-tape', []);

        $samples = [
            array_merge([
                'name' => 'Simpang PDAM',
                'category' => 'Analytic',
                'address' => 'Jl. Teuku Nyak Arief (Arah Darussalam)',
                'lattitude' => '5.561200',
                'longitude' => '95.344800',
                'agency' => 'Dishub',
                'keterangan' => 'Great',
                'path_image' => 'tf1.jpg',
                'url' => $pdamSim['video_url'] ?? '/demo/videos/simpang-pdam.mp4',
            ], $pdamSim['default_roi'] ?? []),
            array_merge([
                'name' => 'Simpang Jambo Tape',
                'category' => 'Analytic',
                'address' => 'Jl. T. Daud Beureueh (Arah Simpang Lima)',
                'lattitude' => '5.558700',
                'longitude' => '95.331500',
                'agency' => 'Diskominfotik',
                'keterangan' => 'Average',
                'path_image' => 'tf2.jpg',
                'url' => $jamboSim['video_url'] ?? '/demo/videos/simpang-jambo-tape.mp4',
            ], $jamboSim['default_roi'] ?? []),
            [
                'name' => 'Simpang Lima Banda Aceh',
                'category' => 'Regular',
                'address' => 'Jl. Tgk. Chik Ditiro (Pusat Kota)',
                'lattitude' => '5.552900',
                'longitude' => '95.326300',
                'agency' => 'Dishub',
                'keterangan' => 'No Data',
                'path_image' => 'tf3.jpg',
                'url' => null,
            ],
            [
                'name' => 'Simpang Surabaya',
                'category' => 'Regular',
                'address' => 'Jl. Tgk. Imum Lueng Bata (Arah Terminal)',
                'lattitude' => '5.542600',
                'longitude' => '95.324800',
                'agency' => 'Dishub',
                'keterangan' => 'No Data',
                'path_image' => 'tf4.jpg',
                'url' => null,
            ],
            [
                'name' => 'Simpang Mesra',
                'category' => 'Regular',
                'address' => 'Jl. Teuku Nyak Arief (Bundaran Mesra)',
                'lattitude' => '5.570100',
                'longitude' => '95.357400',
                'agency' => 'Diskominfotik',
                'keterangan' => 'No Data',
                'path_image' => 'tf5.jpg',
                'url' => null,
            ],
            [
                'name' => 'Simpang Lamnyong',
                'category' => 'Regular',
                'address' => 'Jl. T. Hasan Krueng Kalee (Jembatan Lamnyong)',
                'lattitude' => '5.573400',
                'longitude' => '95.349200',
                'agency' => 'Dishub',
                'keterangan' => 'No Data',
                'path_image' => 'tf1.jpg',
                'url' => null,
            ],
            [
                'name' => 'Simpang Dodik',
                'category' => 'Regular',
                'address' => 'Jl. Pocut Baren (Kuta Alam)',
                'lattitude' => '5.555300',
                'longitude' => '95.323700',
                'agency' => 'Diskominfotik',
                'keterangan' => 'No Data',
                'path_image' => 'tf2.jpg',
                'url' => null,
            ],
            [
                'name' => 'Simpang Neusu',
                'category' => 'Regular',
                'address' => 'Jl. Tgk. Chik Ditiro (Neusu Jaya)',
                'lattitude' => '5.545800',
                'longitude' => '95.317500',
                'agency' => 'Dishub',
                'keterangan' => 'No Data',
                'path_image' => 'tf3.jpg',
                'url' => null,
            ],
            [
                'name' => 'Simpang Batoh',
                'category' => 'Regular',
                'address' => 'Jl. Dr. Mr. Mohd Hasan (Terminal Batoh)',
                'lattitude' => '5.534900',
                'longitude' => '95.331900',
                'agency' => 'Dishub',
                'keterangan' => 'No Data',
                'path_image' => 'tf4.jpg',
                'url' => null,
            ],
            [
                'name' => 'Simpang Seutui',
                'category' => 'Regular',
                'address' => 'Jl. Sultan Iskandar Muda (Seutui)',
                'lattitude' => '5.548400',
                'longitude' => '95.308200',
                'agency' => 'Diskominfotik',
                'keterangan' => 'No Data',
                'path_image' => 'tf5.jpg',
                'url' => null,
            ],
            [
                'name' => 'Simpang Ulee Kareng',
                'category' => 'Regular',
                'address' => 'Jl. T. Iskandar (Pasar Ulee Kareng)',
                'lattitude' => '5.555100',
                'longitude' => '95.360200',
                'agency' => 'Dishub',
                'keterangan' => 'No Data',
                'path_image' => 'tf1.jpg',
                'url' => null,
            ],
            [
                'name' => 'Simpang BPKP',
                'category' => 'Regular',
                'address' => 'Jl. T. Panglima Nyak Makam (Lambhuk)',
                'lattitude' => '5.552300',
                'longitude' => '95.342600',
                'agency' => 'Diskominfotik',
                'keterangan' => 'No Data',
                'path_image' => 'tf2.jpg',
                'url' => null,
            ],
            [
                'name' => 'Simpang Lampineung',
                'category' => 'Regular',
                'address' => 'Jl. T. Nyak Arief (Polda Aceh)',
                'lattitude' => '5.565600',
                'longitude' => '95.351900',
                'agency' => 'Dishub',
                'keterangan' => 'No Data',
                'path_image' => 'tf3.jpg',
                'url' => null,
            ],
            [
                'name' => 'Simpang Keutapang',
                'category' => 'Regular',
                'address' => 'Jl. Soekarno-Hatta (Ketapang)',
                'lattitude' => '5.537200',
                'longitude' => '95.304600',
                'agency' => 'Diskominfotik',
                'keterangan' => 'No Data',
                'path_image' => 'tf4.jpg',
                'url' => null,
            ],
            [
                'name' => 'Simpang Peunayong',
                'category' => 'Regular',
                'address' => 'Jl. Ahmad Yani (Jembatan Peunayong)',
                'lattitude' => '5.560800',
                'longitude' => '95.317400',
                'agency' => 'Dishub',
                'keterangan' => 'No Data',
                'path_image' => 'tf5.jpg',
                'url' => null,
            ],
        ];

        foreach ($samples as $sample) {
            CctvPoint::updateOrCreate(['name' => $sample['name']], $sample);
        }
    }
}
