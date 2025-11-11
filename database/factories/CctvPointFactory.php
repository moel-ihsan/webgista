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
     * @return array
     */
    public function definition()
    {
        return [
            'name' => $this->faker->name,
            'category' => $this->faker->randomElement(['Analytic', 'Regular']),
            'address' => $this->faker->state,
            'lattitude' => $this->faker->latitude(5, 6),
            'longitude' => $this->faker->longitude(95, 96),
            'agency' => $this->faker->randomElement(['Diskominfotik', 'Dishub', 'Diskominfo']),
            'path_image' => $this->faker->randomElement(['tf1.jpg', 'tf2.jpg', 'tf3.jpg', 'tf4.jpg', 'tf5.jpg']),
            'url' => $this->faker->url,
        ];
    }
}
