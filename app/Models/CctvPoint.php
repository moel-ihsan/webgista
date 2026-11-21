<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CctvPoint extends Model
{
    use HasFactory;

    public const ALLOWED_CONDITIONS = [
        'Great',
        'Good',
        'Average',
        'Poor',
        'Bad',
        'Terrible',
        'No Data',
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'category',
        'address',
        'lattitude',
        'longitude',
        'agency',
        'path_image',
        'url',
        'keterangan',
        'rec1x',
        'rec1y',
        'rec2x',
        'rec2y',
        'rec3x',
        'rec3y',
        'rec4x',
        'rec4y',
        'rec5x',
        'rec5y',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'rec1x' => 'float',
        'rec1y' => 'float',
        'rec2x' => 'float',
        'rec2y' => 'float',
        'rec3x' => 'float',
        'rec3y' => 'float',
        'rec4x' => 'float',
        'rec4y' => 'float',
        'rec5x' => 'float',
        'rec5y' => 'float',
    ];
}
