/*********************************************************************
*
*       GetTaskState
*
* Function description
*   Converts the task state from a number to a string
*
* Parameters
*   State:            number of the task state
*/
function GetTaskState(State) {
  var stringState;
  switch (State) {
    case 0:
      stringState = "INACTIVE";
      break;
    case 1:
      stringState = "READY";
      break;
    case 2:
      stringState = "RUNNING";
      break;
    case 3:
      stringState = "WAIT_DLY";
      break;
    case 4:
      stringState = "WAIT_ITV";
      break;
    case 5:
      stringState = "WAIT_OR";
      break;
    case 6:
      stringState = "WAIT_AND";
      break;
    case 7:
      stringState = "WAIT_SEM";
      break;
    case 8:
      stringState = "WAIT_MBX";
      break;
    case 9:
      stringState = "WAIT_MUT";
      break;
    default:
      stringState = "unknown";
      break;
  }
  return stringState;
}

/*********************************************************************
*
*       AddTask
*
* Function description
*   Adds a task to the task window
*
* Parameters
*   Addr:            memory location of the task control block (OS_TCB)
*/
function AddTask(Addr) {
  var task_prio = 0;
  var task_id = 0;
  var task_state_string = "unknown";
  var function_name = "?";
  var task_context;
  var wait_events;
  var set_events;
  var priv_stack_size;
  var delta_time;
  var lock_obj_name = "";

  task_context = Debug.evaluate("*(OS_TCB*)" + Addr);
  function_name = Debug.getSymbol(task_context.ptask);
  task_id = task_context.task_id;
  task_prio = task_context.prio + " (" + task_context.prio_base + ")";
  task_state_string = GetTaskState(task_context.state);
  priv_stack_size = task_context.priv_stack;

  if (priv_stack_size == 0) {
    priv_stack_size = "N/A";
  } else {
    if (TargetInterface.peekWord(task_context.stack) != 0xE25A2EA5) {
      priv_stack_size = priv_stack_size + " Water mark not found!";
    }
  }

  if (task_context.p_rlnk != 0) {
    lock_obj_name = Debug.getSymbol(task_context.p_rlnk);
  }

  delta_time = task_context.delta_time.toString(); // + " / " + task_context.interval_time.toString();
  wait_events = "0x" + task_context.waits.toString(16).toUpperCase();
  set_events = "0x" + task_context.events.toString(16).toUpperCase();

  Threads.add(function_name, task_id, task_prio, task_state_string, lock_obj_name, priv_stack_size, delta_time, wait_events, set_events, Addr);
}

/*********************************************************************
*
*       API Functions
*
**********************************************************************
*/

/*********************************************************************
*
*       init
*
* Function description
*   Initializes the task window
*/
function init() {
  var version_major;
  var version_minor;
  var version_text = "Not found!";

  Threads.clear();
  Threads.newqueue("Task List");
  Threads.setColumns("Name", "ID", "Prio (Base Prio)", "Status", "Lock Obj", "Stack size", "Timeout", "Wait Events", "Set Events");
  Threads.setColor("Status", "READY", "RUNNING", "INACTIVE");
  Threads.setSortByNumber("ID");
  Threads.setSortByNumber("Name");
  Threads.setSortByNumber("Prio (Base Prio)");
  Threads.setSortByNumber("Stack size");
  Threads.setSortByNumber("Timeout");

  version_major = Debug.evaluate("RL_RTX_Version") >> 16;
  version_minor = Debug.evaluate("RL_RTX_Version") & 0xFFFF;

  if (version_major > 0) {
    version_text = version_major + "." + version_minor;
  }

  TargetInterface.message("RL RTX Version: " + version_text);
}

/*********************************************************************
*
*       update
*
* Function description
*   Updates the task window
*/
function update() {
  var i;
  var task_addr;
  var os_max_task_count;

  Threads.clear();

  os_max_task_count = Debug.evaluate("os_maxtaskrun");
  for (i = 0; i < os_max_task_count; i++) {
    task_addr = Debug.evaluate("os_active_TCB[" + i + "]");
    if (task_addr != 0) {
      AddTask(task_addr);
    }
  }
  task_addr = Debug.evaluate("&os_idle_TCB");
  AddTask(task_addr);
}

/*********************************************************************
*
* getregs
*
* Function description
* Returns the register set of a task.
* For ARM cores, this function is expected to return the values
* of registers R0 to R15 and PSR.
*
* Parameters
* hTask: integer number identifying the task.
* Identical to the last parameter supplied to method Threads.add.
* For convenience, this should be the address of the TCB.
*
* Return Values
* An array of unsigned integers containing the task’s register values.
* The array must be sorted according to the logical indexes of the regs.
* The logical register indexing scheme is defined by the ELF-DWARF ABI.
*
**********************************************************************
*/
function getregs(hTask) {
  var i;
  var SP;
  var Addr;
  var task_context;
  var aRegs = new Array(17);

  task_context = Debug.evaluate("*(OS_TCB*)" + hTask);
  SP = task_context.tsk_stack;
  Addr = SP;

  /* the following registers are pushed by the FreeRTOS-scheduler */
  //
  // R4...R11
  //
  for (i = 4; i < 12; i++) {
    aRegs[i] = TargetInterface.peekWord(Addr);
    Addr += 4;
  }

  //
  // EXEC_RET
  //
  // LR = TargetInterface.peekWord(Addr);
  // Addr += 4;
  //
  // S16...S31
  //
  // if ((LR & 0x10) != 0x10) { // FP context has been saved?
  if (task_context.ret_upd & 0x02) { // FP context has been saved?
    Addr += 4 * 16; // skip S16..S31
  }

  /* the following registers are pushed by the ARM core */
  //
  // R0...R3
  //
  for (i = 0; i < 4; i++) {
    aRegs[i] = TargetInterface.peekWord(Addr);
    Addr += 4;
  }

  //
  // R12, LR, PC, PSR
  //
  aRegs[12] = TargetInterface.peekWord(Addr);
  Addr += 4;
  aRegs[14] = TargetInterface.peekWord(Addr);
  Addr += 4;
  aRegs[15] = TargetInterface.peekWord(Addr);
  Addr += 4;
  aRegs[16] = TargetInterface.peekWord(Addr);
  Addr += 4;

  //
  // S0..S15
  //
  // if ((LR & 0x10) != 0x10) { // FP context has been saved?
  if (task_context.ret_upd & 0x02) { // FP context has been saved?
    Addr += 4 * 18; // skip S0...S15
  }
  
  //TODO: Not sure about it, just copied from FreeRTOS
  if (aRegs[16] & (1 << 9)) { // Stack has been 8-byte aligned
    Addr += 4;
  }

  //
  // SP
  //
  aRegs[13] = Addr;

  return aRegs;
}

/*********************************************************************
*
*       getContextSwitchAddrs
*
*  Functions description
*    Returns an unsigned integer array containing the base addresses
*    of all functions that complete a task switch when executed.
*/
function getContextSwitchAddrs() {
  var aAddrs;
  var Addr;

  Addr = Debug.evaluate("&rt_switch_req");

  if (Addr != undefined) {
    aAddrs = new Array(1);
    aAddrs[0] = Addr;
    return aAddrs;
  }

  return [];
}

/*********************************************************************
*
* getname
*
* Function description
* Returns the name of a task.
*
* Parameters
* hTask: see the description of method getregs.
*
**********************************************************************
*/
function getname(hTask) {
  var task_context;

  task_context = Debug.evaluate("*(OS_TCB*)" + hTask);
  return Debug.getSymbol(task_context.ptask);
}

/*********************************************************************
*
*       getOSName()
*
*  Functions description:
*    Returns the name of the RTOS this script supplies support for
*/
function getOSName() {
  return "Keil RTX4";
}
