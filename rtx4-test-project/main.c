#include <rtl.h>
#include <stdint.h>
#include <stdio.h>

static OS_MUT _mutex_test;

uint64_t stack_task1[512 / 8];
uint64_t stack_task2[768 / 8];

void task1(void) {

    os_mut_init(_mutex_test);
    os_mut_wait(_mutex_test, 0xFFFF);

    for (;;) {
        os_dly_wait(10);
    }
}

void task2(void) {

    for (;;) {
        os_mut_wait(_mutex_test, 0xFFFF);
        os_dly_wait(1);
    }
}

void init(void) {

    os_tsk_create_user(task1, 2, stack_task1, sizeof(stack_task1));
    os_tsk_create_user(task2, 3, stack_task2, sizeof(stack_task2));

    os_dly_wait(10);

    os_tsk_delete_self();
}

int main(void) {

    os_sys_init(init);

    return 0;
}
