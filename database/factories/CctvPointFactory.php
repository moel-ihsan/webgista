<?php

namespace Database\Factories;

use App\Models\CctvPoint;
use Illuminate\Database\Eloquent\Factories\Factory;

class CctvPointFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = CctvPoint::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition()
    {
        return [
            'name' => $this->faker->streetName,
            'category' => $this->faker->randomElement(['Analytic', 'Regular']),
            'address' => $this->faker->address,
            'lattitude' => (string) $this->faker->latitude(5.5, 5.6),
            'longitude' => (string) $this->faker->longitude(95.3, 95.4),
            'agency' => $this->faker->randomElement(['Diskominfotik', 'Dishub']),
            'keterangan' => 'Great',
            'path_image' => $this->faker->randomElement(['tf1.jpg', 'tf2.jpg', 'tf3.jpg', 'tf4.jpg', 'tf5.jpg']),
            'url' => null,
        ];
    }
}
