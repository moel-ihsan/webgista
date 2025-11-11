<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCctvPointsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('cctv_points', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('category');
            $table->string('address');
            $table->string('lattitude');
            $table->string('longitude');
            $table->string('agency');
            $table->string('keterangan');
            $table->string('path_image');
            $table->string('url');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('cctv_points');
    }
}
