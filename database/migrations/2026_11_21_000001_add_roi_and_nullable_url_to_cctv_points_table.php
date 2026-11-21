<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AddRoiAndNullableUrlToCctvPointsTable extends Migration
{
    private const ROI_COLUMNS = [
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
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('cctv_points', function (Blueprint $table) {
            $table->string('url')->nullable()->change();

            foreach (self::ROI_COLUMNS as $column) {
                $table->float($column)->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        DB::table('cctv_points')->whereNull('url')->update(['url' => '']);

        Schema::table('cctv_points', function (Blueprint $table) {
            $table->dropColumn(self::ROI_COLUMNS);
        });

        Schema::table('cctv_points', function (Blueprint $table) {
            $table->string('url')->nullable(false)->change();
        });
    }
}
